import io
import json
from urllib.parse import parse_qs, urlparse

import pytest
from src import solar


def body(**kw):
    return {"latitude": 52.5, "longitude": 13.4, "systemLossPercent": 14,
            "groups": [{"faceId": "a", "tiltDeg": 35, "azimuthDeg": 180, "powerKwp": 4.5}], **kw}


def test_compass_to_pvgis():
    assert [solar.pvgis_aspect(v) for v in (0, 90, 180, 270, 360)] == [-180, -90, 0, 90, -180]


@pytest.mark.parametrize("kw", [{"latitude": None}, {"longitude": float('inf')}, {"latitude": 91},
                               {"systemLossPercent": -1}, {"groups": []}, {"groups": [{}]}])
def test_invalid_inputs_never_call_network(kw):
    with pytest.raises(ValueError):
        solar.estimate_yield(body(**kw), query=lambda *args: pytest.fail("unexpected network query"))


def test_one_specific_query_per_orientation_and_power_weighting():
    calls = []
    def query(*args):
        calls.append(args)
        return {"status": "available", "specificKwhPerKwp": 1000, "radiationDatabase": "fixture"}
    groups = body()["groups"] * 2
    result = solar.estimate_yield(body(groups=groups), query=query)
    assert len(calls) == 1
    assert calls[0] == (52.5, 13.4, 35, 180, 14)
    assert result["annualKwh"] == 9000
    assert result["economics"] == {
        "dailyKwh": 24.66,
        "dailyEnergyValueEur": 9.54,
        "selfConsumedKwh": 7.4,
        "exportedKwh": 17.26,
        "dailySavingsEur": 2.86,
        "dailyFeedInRevenueEur": 1.33,
        "dailyBenefitEur": 4.19,
        "electricityPriceEurPerKwh": 0.3869,
        "selfConsumptionPercent": 30.0,
        "priceSource": "Destatis 61243-0001 · 2. Halbjahr 2025 · 2.500 bis unter 5.000 kWh",
        "priceSourceUrl": solar.ELECTRICITY_PRICE_SOURCE_URL,
        "feedInRateEurPerKwh": .077,
        "compensationModel": "feed_in_tariff",
        "compensationSource": "Bundesnetzagentur · EEG-Fördersätze · 08/2026–01/2027",
        "compensationSourceUrl": solar.EEG_COMPENSATION_SOURCE_URL,
    }


def test_eeg_compensation_is_power_weighted_and_switches_to_direct_marketing():
    small = solar.feed_in_compensation(50)
    assert small["compensationModel"] == "feed_in_tariff"
    assert small["feedInRateEurPerKwh"] == pytest.approx(.06624)
    large = solar.feed_in_compensation(118.3)
    assert large["compensationModel"] == "direct_marketing"
    assert large["feedInRateEurPerKwh"] == pytest.approx((10*.081+30*.0706+78.3*.0584)/118.3)
    assert solar.feed_in_compensation(1001)["feedInRateEurPerKwh"] is None


def test_missing_data_is_unknown_not_zero_and_partial_is_explicit():
    def query(lat, lon, tilt, az, loss):
        return {"status": "unavailable"} if az == 0 else {"status": "available", "specificKwhPerKwp": 1000}
    groups = [body()["groups"][0], {**body()["groups"][0], "faceId": "b", "azimuthDeg": 0}]
    result = solar.estimate_yield(body(groups=groups), query=query)
    assert result["status"] == "partial" and result["annualKwh"] is None
    assert result["economics"] is None
    assert result["availableAnnualKwh"] == 4500 and result["groups"][1]["annualKwh"] is None
    result = solar.estimate_yield(body(groups=groups[1:]), query=query)
    assert result["status"] == "unavailable" and result["annualKwh"] is None


def test_proxy_uses_fixed_official_url_cache_and_one_kwp(monkeypatch):
    solar._cache.clear()
    calls = []
    def open_response(req, timeout):
        calls.append((req.full_url, timeout))
        return io.BytesIO(json.dumps({"outputs": {"totals": {"fixed": {"E_y": 980}},
            "monthly": {"fixed": [{"month": month, "E_m": month * 10} for month in range(1, 13)]}},
            "inputs": {"meteo_data": {"radiation_db": "fixture", "year_min": 2005, "year_max": 2023}}}).encode())
    monkeypatch.setattr(solar, "urlopen", open_response)
    first = solar._specific_yield(-33, 151, 20, 0, 14)
    assert solar._specific_yield(-33, 151, 20, 0, 14) == first
    assert len(calls) == 1
    url, timeout = calls[0]
    assert url.startswith(solar.PVGIS_URL + '?') and timeout == 8
    params = parse_qs(urlparse(url).query)
    assert params['aspect'] == ['-180.0'] and params['peakpower'] == ['1']
    assert first['yearEnd'] == 2023
    assert first['monthlyKwhPerKwp'] == [month * 10 for month in range(1, 13)]


def test_real_monthly_pvgis_values_drive_summer_winter_and_average_daily_euros():
    def query(*_args):
        return {"status": "available", "specificKwhPerKwp": 780,
                "monthlyKwhPerKwp": [month * 10 for month in range(1, 13)]}
    result = solar.estimate_yield(body(), query=query)
    assert result["monthlyKwh"] == [month * 45 for month in range(1, 13)]
    economics = result["economics"]
    assert economics["dailyKwh"] == 9.62
    assert economics["dailyBenefitEur"] == 1.63
    assert economics["seasonal"]["summer"] == {
        "months": [6, 7, 8], "days": 92, "totalKwh": 945.0,
        "dailyKwh": 10.27, "dailyEnergyValueEur": 3.97,
        "selfConsumedKwh": 3.08, "exportedKwh": 7.19,
        "dailySavingsEur": 1.19, "dailyFeedInRevenueEur": .55, "dailyBenefitEur": 1.75,
    }
    assert economics["seasonal"]["winter"]["months"] == [12, 1, 2]
    assert economics["seasonal"]["winter"]["dailyKwh"] == 7.5
    assert economics["seasonal"]["winter"]["dailyBenefitEur"] == 1.27


def test_network_failure_is_cached_and_never_fabricates_yield(monkeypatch):
    solar._cache.clear()
    calls = []
    def fail(*args, **kwargs):
        calls.append(1)
        raise TimeoutError()
    monkeypatch.setattr(solar, "urlopen", fail)
    assert solar._specific_yield(1, 2, 3, 4, 5)['status'] == 'unavailable'
    assert solar._specific_yield(1, 2, 3, 4, 5)['status'] == 'unavailable'
    assert len(calls) == 1


def test_orientation_budget_is_checked_before_requests():
    groups = [{**body()['groups'][0], 'azimuthDeg': i*10} for i in range(9)]
    with pytest.raises(ValueError, match='eight'):
        solar.estimate_yield(body(groups=groups), query=lambda *args: pytest.fail('unexpected network'))
