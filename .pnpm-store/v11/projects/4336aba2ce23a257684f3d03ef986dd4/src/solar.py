"""Bounded, read-only PVGIS adapter. No sunshine or yield is invented.

Compass azimuth: N=0,E=90,S=180,W=270. PVGIS 5.3: S=0,W=90,E=-90.
Reference: JRC 'API non-interactive service', Grid-connected PV / PVcalc.
"""
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import json
import math
from threading import BoundedSemaphore, Lock
import time
from urllib.parse import urlencode
from urllib.request import Request, urlopen

PVGIS_URL = "https://re.jrc.ec.europa.eu/api/v5_3/PVcalc"
SOURCE_URL = "https://joint-research-centre.ec.europa.eu/photovoltaic-geographical-information-system-pvgis/using-pvgis-5/api-non-interactive-service_en"
ELECTRICITY_PRICE_SOURCE_URL = "https://genesis.destatis.de/datenbank/online/table/61243-0001"
EEG_COMPENSATION_SOURCE_URL = "https://www.bundesnetzagentur.de/DE/Fachthemen/ElektrizitaetundGas/ErneuerbareEnergien/EEG_Foerderung/start.html"
DEFAULT_ELECTRICITY_PRICE_EUR_PER_KWH = 0.3869
DEFAULT_SELF_CONSUMPTION_PERCENT = 30
MONTH_DAYS = (31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31)
SUMMER_MONTHS = (6, 7, 8)
WINTER_MONTHS = (12, 1, 2)
_cache = {}
_lock = Lock()
_requests = BoundedSemaphore(2)


def number(value, name, minimum, maximum):
    if isinstance(value, bool) or value is None:
        raise ValueError(f"{name} is required")
    try:
        result = float(value)
    except (TypeError, ValueError):
        raise ValueError(f"Invalid {name}") from None
    if not math.isfinite(result) or not minimum <= result <= maximum:
        raise ValueError(f"Invalid {name}")
    return result


def pvgis_aspect(azimuth):
    return (number(azimuth, "azimuthDeg", 0, 360) % 360) - 180


def _weighted_rate(power_kwp, tiers):
    remaining, previous, value = power_kwp, 0.0, 0.0
    for limit, rate in tiers:
        amount = max(0.0, min(remaining, limit - previous))
        value += amount * rate
        remaining -= amount
        previous = limit
        if remaining <= 1e-9:
            break
    return None if power_kwp <= 0 or remaining > 1e-9 else value / power_kwp


def feed_in_compensation(power_kwp):
    """EEG rooftop-PV values for commissioning 2026-08-01 through 2027-01-31."""
    power = number(power_kwp, "powerKwp", 0.001, 100000)
    if power <= 100:
        rate = _weighted_rate(power, ((10, .0770), (40, .0666), (100, .0544)))
        model = "feed_in_tariff"
    elif power <= 1000:
        rate = _weighted_rate(power, ((10, .0810), (40, .0706), (100, .0584), (400, .0584), (1000, .0584)))
        model = "direct_marketing"
    else:
        rate, model = None, "tender_required"
    return {"feedInRateEurPerKwh": rate, "compensationModel": model,
            "compensationSource": "Bundesnetzagentur · EEG-Fördersätze · 08/2026–01/2027",
            "compensationSourceUrl": EEG_COMPENSATION_SOURCE_URL}


def _specific_yield(latitude, longitude, tilt, azimuth, loss):
    key = tuple(round(v, 5 if i < 2 else 2) for i, v in enumerate((latitude, longitude, tilt, azimuth, loss)))
    with _lock:
        previous = _cache.get(key)
        if previous and previous[0] > time.monotonic():
            return previous[1]
    if not _requests.acquire(blocking=False):
        return {"status": "unavailable", "reason": "PVGIS busy; retry the calculation"}
    try:
        params = {"lat": key[0], "lon": key[1], "angle": key[2], "aspect": pvgis_aspect(key[3]),
                  "peakpower": 1, "loss": key[4], "pvtechchoice": "crystSi", "mountingplace": "free",
                  "usehorizon": 1, "outputformat": "json"}
        request = Request(PVGIS_URL + "?" + urlencode(params), headers={"Accept": "application/json", "User-Agent": "VECTOPLAN-Solar/1"})
        with urlopen(request, timeout=8) as response:
            raw = response.read(2_000_001)
        if len(raw) > 2_000_000:
            raise ValueError("PVGIS response too large")
        payload = json.loads(raw)
        annual = number(payload["outputs"]["totals"]["fixed"]["E_y"], "annual yield", 0, 5000)
        monthly_rows = payload.get("outputs", {}).get("monthly", {}).get("fixed", [])
        monthly = [None] * 12
        if isinstance(monthly_rows, list):
            for row in monthly_rows:
                if not isinstance(row, dict):
                    continue
                try:
                    month = int(number(row.get("month"), "month", 1, 12))
                    monthly[month - 1] = number(row.get("E_m"), "monthly yield", 0, 1000)
                except ValueError:
                    monthly = [None] * 12
                    break
        meteo = payload.get("inputs", {}).get("meteo_data", {})
        result = {"status": "available", "specificKwhPerKwp": annual,
                  "radiationDatabase": meteo.get("radiation_db"), "yearStart": meteo.get("year_min"),
                  "yearEnd": meteo.get("year_max"), "retrievedAt": datetime.now(timezone.utc).isoformat()}
        if all(value is not None for value in monthly):
            result["monthlyKwhPerKwp"] = [round(value, 4) for value in monthly]
    except Exception as exc:
        result = {"status": "unavailable", "reason": f"PVGIS data unavailable ({type(exc).__name__})"}
    finally:
        _requests.release()
    with _lock:
        if len(_cache) >= 512:
            _cache.pop(next(iter(_cache)))
        _cache[key] = (time.monotonic() + (86400 if result["status"] == "available" else 60), result)
    return result


def estimate_yield(body, query=_specific_yield):
    latitude = number(body.get("latitude"), "latitude", -90, 90)
    longitude = number(body.get("longitude"), "longitude", -180, 180)
    loss = number(body.get("systemLossPercent", 14), "systemLossPercent", 0, 50)
    electricity_price = number(body.get("electricityPriceEurPerKwh", DEFAULT_ELECTRICITY_PRICE_EUR_PER_KWH),
                               "electricityPriceEurPerKwh", 0, 5)
    self_consumption = number(body.get("selfConsumptionPercent", DEFAULT_SELF_CONSUMPTION_PERCENT),
                              "selfConsumptionPercent", 0, 100)
    raw_groups = body.get("groups")
    if not isinstance(raw_groups, list) or not 1 <= len(raw_groups) <= 32:
        raise ValueError("Select 1 to 32 roof faces")
    groups = []
    for group in raw_groups:
        if not isinstance(group, dict):
            raise ValueError("Invalid roof face")
        groups.append({"faceId": str(group.get("faceId", ""))[:100],
                       "tiltDeg": number(group.get("tiltDeg"), "tiltDeg", 0, 90),
                       "azimuthDeg": number(group.get("azimuthDeg"), "azimuthDeg", 0, 360),
                       "powerKwp": number(group.get("powerKwp"), "powerKwp", .001, 10000)})
    # Cache/model once per orientation, with a hard ceiling on outbound work.
    orientations = list(dict.fromkeys((round(g["tiltDeg"], 2), round(g["azimuthDeg"], 2)) for g in groups))
    if len(orientations) > 8:
        raise ValueError("Calculate at most eight different orientations at once")
    def calculate(angles):
        return angles, query(latitude, longitude, *angles, loss)
    with ThreadPoolExecutor(max_workers=2) as pool:
        estimates = dict(pool.map(calculate, orientations))
    results = []
    for group in groups:
        model = estimates[(round(group["tiltDeg"], 2), round(group["azimuthDeg"], 2))]
        annual = round(group["powerKwp"] * model["specificKwhPerKwp"], 1) if model["status"] == "available" else None
        monthly_specific = model.get("monthlyKwhPerKwp")
        monthly = ([round(group["powerKwp"] * value, 2) for value in monthly_specific]
                   if isinstance(monthly_specific, list) and len(monthly_specific) == 12
                   and all(isinstance(value, (int, float)) and math.isfinite(value) and value >= 0 for value in monthly_specific)
                   else None)
        results.append({**group, **model, "annualKwh": annual, "monthlyKwh": monthly})
    complete = all(g["annualKwh"] is not None for g in results)
    available = round(sum(g["annualKwh"] or 0 for g in results), 1)
    annual = available if complete else None
    power_kwp = sum(g["powerKwp"] for g in groups)
    compensation = feed_in_compensation(power_kwp)
    economics = None
    if annual is not None:
        def period_economics(total_kwh, days):
            daily = total_kwh / days
            self_consumed = daily * self_consumption / 100
            exported = daily - self_consumed
            savings = self_consumed * electricity_price
            feed_in_revenue = (None if compensation["feedInRateEurPerKwh"] is None
                               else exported * compensation["feedInRateEurPerKwh"])
            return {"dailyKwh": round(daily, 2),
                    "dailyEnergyValueEur": round(daily * electricity_price, 2),
                    "selfConsumedKwh": round(self_consumed, 2),
                    "exportedKwh": round(exported, 2),
                    "dailySavingsEur": round(savings, 2),
                    "dailyFeedInRevenueEur": None if feed_in_revenue is None else round(feed_in_revenue, 2),
                    "dailyBenefitEur": None if feed_in_revenue is None else round(savings + feed_in_revenue, 2)}
        economics = {**period_economics(annual, 365),
                     "electricityPriceEurPerKwh": electricity_price,
                     "selfConsumptionPercent": self_consumption,
                     "priceSource": "Destatis 61243-0001 · 2. Halbjahr 2025 · 2.500 bis unter 5.000 kWh",
                     "priceSourceUrl": ELECTRICITY_PRICE_SOURCE_URL,
                     **compensation}
        if all(isinstance(group.get("monthlyKwh"), list) for group in results):
            monthly_kwh = [round(sum(group["monthlyKwh"][month] for group in results), 2) for month in range(12)]
            def season(months):
                total = round(sum(monthly_kwh[month - 1] for month in months), 2)
                days = sum(MONTH_DAYS[month - 1] for month in months)
                return {"months": list(months), "days": days, "totalKwh": total,
                        **period_economics(total, days)}
            economics["seasonal"] = {"summer": season(SUMMER_MONTHS), "winter": season(WINTER_MONTHS)}
        else:
            monthly_kwh = None
    return {"ok": True, "status": "available" if complete else "partial" if any(g["annualKwh"] is not None for g in results) else "unavailable",
            "annualKwh": annual, "availableAnnualKwh": available, "economics": economics,
            "monthlyKwh": monthly_kwh if annual is not None else None,
            "source": "JRC PVGIS 5.3", "sourceUrl": SOURCE_URL, "latitude": latitude, "longitude": longitude,
            "systemLossPercent": loss, "powerKwp": power_kwp, "compensationSourceUrl": EEG_COMPENSATION_SOURCE_URL, "groups": results,
            "limitations": ["Long-term model estimate, not a measured or guaranteed yield",
                            "Nearby building/tree and module-row shading not simulated",
                            "Self-consumption is a planning share without a measured building load profile",
                            "Feed-in revenue uses the published EEG value; direct-marketing costs are not deducted",
                            "Module dimensions/power and system loss are planning inputs"]}
