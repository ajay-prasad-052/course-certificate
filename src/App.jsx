import "./App.css";
import { useEffect, useRef, useState } from "react";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

function App() {
  const [isCertificateOpen, setIsCertificateOpen] = useState(false);
  const [certificateError, setCertificateError] = useState("");
  const viewerRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!isCertificateOpen) return undefined;

    const closeOnEscape = (event) => {
      if (event.key === "Escape") setIsCertificateOpen(false);
    };

    document.addEventListener("keydown", closeOnEscape);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      document.body.style.overflow = "";
    };
  }, [isCertificateOpen]);

  useEffect(() => {
    if (!isCertificateOpen) return undefined;

    let isCancelled = false;
    let renderTask;
    let renderVersion = 0;
    let resizeObserver;
    let loadingTask;

    const renderCertificate = async () => {
      try {
        const pdfjsLib = await import("pdfjs-dist");
        if (isCancelled) return;
        pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
        loadingTask = pdfjsLib.getDocument({
          url: "/certificates/course-certificate.pdf",
        });
        const pdf = await loadingTask.promise;
        if (isCancelled) return;

        const page = await pdf.getPage(1);
        const canvas = canvasRef.current;
        const viewer = viewerRef.current;
        if (!canvas || !viewer || isCancelled) return;

        const baseViewport = page.getViewport({ scale: 1 });
        const resizeCanvas = () => {
          const currentVersion = ++renderVersion;

          const drawCanvas = async () => {
            if (renderTask) {
              renderTask.cancel();
              try {
                await renderTask.promise;
              } catch {
                // A cancelled render is expected when the viewport changes.
              }
            }
            if (isCancelled || currentVersion !== renderVersion) return;

            const availableWidth = Math.max(viewer.clientWidth - 32, 1);
            const availableHeight = Math.max(viewer.clientHeight - 32, 1);
            const fitScale = Math.min(
              availableWidth / baseViewport.width,
              availableHeight / baseViewport.height,
            );
            const pixelRatio = window.devicePixelRatio || 1;
            const viewport = page.getViewport({ scale: fitScale * pixelRatio });

            canvas.width = viewport.width;
            canvas.height = viewport.height;
            canvas.style.width = `${viewport.width / pixelRatio}px`;
            canvas.style.height = `${viewport.height / pixelRatio}px`;

            renderTask = page.render({
              canvasContext: canvas.getContext("2d"),
              viewport,
            });
            try {
              await renderTask.promise;
            } catch (error) {
              if (
                !isCancelled &&
                currentVersion === renderVersion &&
                error.name !== "RenderingCancelledException"
              ) {
                setCertificateError("The certificate could not be displayed.");
              }
            }
          };

          void drawCanvas();
        };

        resizeObserver = new ResizeObserver(resizeCanvas);
        resizeObserver.observe(viewer);
        resizeCanvas();
      } catch {
        if (!isCancelled) {
          setCertificateError("The certificate could not be displayed.");
        }
      }
    };

    renderCertificate();

    return () => {
      isCancelled = true;
      resizeObserver?.disconnect();
      renderTask?.cancel();
      if (loadingTask) void loadingTask.destroy();
    };
  }, [isCertificateOpen]);

  return (
    <div className="verification-page">
      <button
        className="certificate-button"
        onClick={() => {
          setCertificateError("");
          setIsCertificateOpen(true);
        }}
      >
        Open Certificate
      </button>

      {isCertificateOpen && (
        <section
          ref={viewerRef}
          className="certificate-viewer"
          role="dialog"
          aria-modal="true"
          aria-label="Course certificate"
        >
          {certificateError ? (
            <p className="certificate-error" role="alert">
              {certificateError}
            </p>
          ) : (
            <canvas
              ref={canvasRef}
              className="certificate-document"
              role="img"
              aria-label="Course certificate"
            />
          )}
        </section>
      )}
    </div>
  );
}

export default App;
