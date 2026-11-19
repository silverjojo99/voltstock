import { useEffect, useRef, useState } from "react";
import { Camera, Download, QrCode } from "lucide-react";
import { QRCodeCanvas } from "qrcode.react";

export default function QrTools({ t }) {
  const [input, setInput] = useState("");
  const [qrValue, setQrValue] = useState("");
  const [scanResult, setScanResult] = useState("");
  const [scanError, setScanError] = useState("");
  const [scanning, setScanning] = useState(false);
  const [starting, setStarting] = useState(false);
  const videoRef = useRef(null);
  const qrContainerRef = useRef(null);
  const controlsRef = useRef(null);
  const mountedRef = useRef(false);
  const scanRequestRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      scanRequestRef.current += 1;
      controlsRef.current?.stop();
    };
  }, []);

  const generateQr = (event) => {
    event.preventDefault();
    const value = input.trim();
    if (!value) {
      setQrValue("");
      return;
    }
    setQrValue(value);
  };

  const downloadQr = () => {
    const canvas = qrContainerRef.current?.querySelector("canvas");
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = "voltstock-qr.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  const startScanner = async () => {
    const requestId = scanRequestRef.current + 1;
    scanRequestRef.current = requestId;
    setScanError("");
    setScanResult("");
    setStarting(true);
    setScanning(true);

    try {
      if (!videoRef.current) throw new Error(t("qr.videoUnavailable"));
      const { BrowserMultiFormatReader } = await import("@zxing/browser");
      const reader = new BrowserMultiFormatReader();
      const controls = await reader.decodeFromVideoDevice(
        undefined,
        videoRef.current,
        (result, error, callbackControls) => {
          if (!mountedRef.current || scanRequestRef.current !== requestId) return;
          if (result) {
            setScanResult(result.getText());
            setScanning(false);
            setStarting(false);
            scanRequestRef.current += 1;
            callbackControls.stop();
            controlsRef.current = null;
          } else if (error && !["NotFoundException", "ChecksumException", "FormatException"].includes(error.name)) {
            const message = error instanceof Error ? error.message : String(error);
            setScanError(t("qr.cameraFailed", { message }));
            setScanning(false);
            setStarting(false);
            scanRequestRef.current += 1;
            callbackControls.stop();
            controlsRef.current = null;
          }
        },
      );

      if (!mountedRef.current || scanRequestRef.current !== requestId) {
        controls.stop();
      } else {
        controlsRef.current = controls;
      }
    } catch (error) {
      if (mountedRef.current && scanRequestRef.current === requestId) {
        const message = error instanceof Error ? error.message : String(error);
        setScanError(t("qr.cameraFailed", { message }));
        setScanning(false);
      }
    } finally {
      if (mountedRef.current && scanRequestRef.current === requestId) setStarting(false);
    }
  };

  const stopScanner = () => {
    scanRequestRef.current += 1;
    controlsRef.current?.stop();
    controlsRef.current = null;
    setScanning(false);
    setStarting(false);
  };

  return (
    <section className="qr-tools" aria-label={t("qr.section")}>
      <article className="card qr-card qr-generator">
        <div className="qr-card__head">
          <span className="qr-card__icon"><QrCode size={21} /></span>
          <div>
            <h2>{t("qr.generateTitle")}</h2>
            <p className="muted">{t("qr.generateDescription")}</p>
          </div>
        </div>
        <form className="qr-generator__form" onSubmit={generateQr}>
          <label className="field">
            <span className="field__label">{t("qr.contentLabel")}</span>
            <input
              type="text"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder={t("qr.contentPlaceholder")}
            />
          </label>
          <button className="btn btn--primary" type="submit">{t("qr.generateButton")}</button>
        </form>
        {qrValue ? (
          <div className="qr-generator__output">
            <div className="qr-generator__canvas" ref={qrContainerRef}>
              <QRCodeCanvas value={qrValue} size={220} level="M" marginSize={2} />
            </div>
            <button className="btn btn--ghost btn--sm" type="button" onClick={downloadQr}>
              <Download size={16} /> {t("qr.download")}
            </button>
          </div>
        ) : (
          <div className="qr-placeholder"><QrCode size={38} /><span>{t("qr.previewPlaceholder")}</span></div>
        )}
      </article>

      <article className="card qr-card qr-scanner">
        <div className="qr-card__head">
          <span className="qr-card__icon"><Camera size={21} /></span>
          <div>
            <h2>{t("qr.scanTitle")}</h2>
            <p className="muted">{t("qr.scanDescription")}</p>
          </div>
        </div>
        <div className="qr-scanner__preview">
          <video ref={videoRef} autoPlay muted playsInline aria-label={t("qr.cameraPreview")} />
          {!scanning && <div className="qr-scanner__overlay">{t("qr.cameraIdle")}</div>}
        </div>
        <button
          className={`btn ${scanning ? "btn--ghost" : "btn--primary"}`}
          type="button"
          onClick={scanning ? stopScanner : startScanner}
        >
          <Camera size={17} /> {scanning ? t("qr.stopButton") : t("qr.startButton")}
        </button>
        {scanError && <p className="form-message form-message--error" role="alert">{scanError}</p>}
        {scanResult && (
          <div className="qr-scanner__result" role="status">
            <strong>{t("qr.resultLabel")}</strong>
            <p>{scanResult}</p>
          </div>
        )}
      </article>
    </section>
  );
}
