(() => {
  "use strict";

  const dataNode = document.getElementById("structural-report-data");
  const reportData = JSON.parse(dataNode.textContent);
  const endpoint = document.body.dataset.reportApi;

  function renderResultGraphic() {
    const canvas = document.getElementById("report-result-canvas");
    const visual = reportData.dossier?.visualizations?.[0];
    if (!canvas || !visual) return;
    const context = canvas.getContext("2d");
    const width = canvas.width;
    const height = canvas.height;
    context.clearRect(0, 0, width, height);
    context.fillStyle = "#f5f8f9";
    context.fillRect(0, 0, width, height);
    context.font = "600 22px Segoe UI";
    context.fillStyle = "#173b55";
    context.fillText(visual.title, 28, 38);
    if (visual.kind === "surface_field") {
      const rows = visual.grid?.rows || [];
      const values = rows.flatMap((row) => row.map((cell) => Math.abs(Number(cell.w_mm))));
      const maximum = Math.max(...values, 1e-9);
      const palette = ["#173bff", "#05a9db", "#10c88a", "#f2d33f", "#ef553b"];
      const plot = { x: 28, y: 58, w: width - 56, h: height - 94 };
      rows.forEach((row, iy) => row.forEach((cell, ix) => {
        const ratio = Math.abs(Number(cell.w_mm)) / maximum;
        context.fillStyle = palette[Math.min(palette.length - 1, Math.floor(ratio * palette.length))];
        context.fillRect(plot.x + ix * plot.w / row.length, plot.y + iy * plot.h / rows.length, plot.w / row.length + 1, plot.h / rows.length + 1);
      }));
      context.fillStyle = "#405966";
      context.font = "18px Segoe UI";
      context.fillText(`Verformung |w|max = ${maximum.toFixed(3)} mm`, 28, height - 14);
      return;
    }
    const samples = (visual.spans || []).flatMap((span) => span.samples || []);
    if (!samples.length) return;
    const maxX = Math.max(...samples.map((point) => Number(point.x_global_m)), 1);
    const maxM = Math.max(...samples.map((point) => Math.abs(Number(point.moment_knm))), 1e-9);
    const baseline = height * .58;
    context.strokeStyle = "#81949e";
    context.beginPath(); context.moveTo(28, baseline); context.lineTo(width - 28, baseline); context.stroke();
    context.strokeStyle = "#0c9aa0"; context.lineWidth = 4; context.beginPath();
    samples.forEach((point, index) => {
      const x = 28 + Number(point.x_global_m) / maxX * (width - 56);
      const y = baseline + Number(point.moment_knm) / maxM * (height * .32);
      if (index) context.lineTo(x, y); else context.moveTo(x, y);
    });
    context.stroke();
    context.fillStyle = "#405966"; context.font = "18px Segoe UI";
    context.fillText(`Momentenlinie |M|max = ${maxM.toFixed(2)} kNm`, 28, height - 14);
  }

  function setPath(root, path, value) {
    const parts = path.split(".");
    let cursor = root;
    parts.slice(0, -1).forEach((part) => {
      cursor = /^\d+$/.test(part) ? cursor[Number(part)] : cursor[part];
    });
    const key = parts.at(-1);
    if (/^\d+$/.test(key)) cursor[Number(key)] = value;
    else cursor[key] = value;
  }

  function currentJob() {
    const job = structuredClone(reportData.job);
    document.querySelectorAll("input[data-path]").forEach((input) => {
      const numeric = input.dataset.original !== "" && !Number.isNaN(Number(input.dataset.original));
      setPath(job, input.dataset.path, numeric ? Number(input.value) : input.value);
    });
    return job;
  }

  async function generate(format) {
    const buttons = [...document.querySelectorAll("button[data-action]")];
    const status = document.getElementById("report-status");
    buttons.forEach((button) => { button.disabled = true; });
    status.textContent = "Berechnung läuft …";
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ format, job: currentJob() }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.message || "Bericht konnte nicht erzeugt werden");
      }
      if (format === "html") {
        const markup = await response.text();
        document.open();
        document.write(markup);
        document.close();
        return;
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${reportData.job.job_ref}-statikbericht.pdf`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
      status.textContent = "PDF wurde erzeugt.";
    } catch (error) {
      status.textContent = error.message;
    } finally {
      buttons.forEach((button) => { button.disabled = false; });
    }
  }

  document.querySelectorAll("input[data-path]").forEach((input) => {
    input.addEventListener("input", () => {
      document.title = `ENTWURF · ${document.title.replace("ENTWURF · ", "")}`;
      document.getElementById("report-status").textContent = "Eingaben geändert · Neuberechnung erforderlich.";
    });
  });
  document.querySelector('[data-action="recalculate"]').addEventListener("click", () => generate("html"));
  document.querySelector('[data-action="pdf"]').addEventListener("click", () => generate("pdf"));
  renderResultGraphic();
})();
