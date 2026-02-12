import { useEffect, useMemo, useState } from "react";
import { Camera, MessageSquareText, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/input";
import { analyticsClient } from "@/lib/analyticsClient";
import { getConsoleLogs, startConsoleCapture } from "@/utils/consoleRecorder";

const FEEDBACK_TAG = "beta_cohort";

type FeedbackPayload = {
  message: string;
  screenshot: string | null;
  userAgent: string;
  consoleLogs: ReturnType<typeof getConsoleLogs>;
  tags: string[];
  createdAt: string;
};

async function captureScreenshot(): Promise<string | null> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getDisplayMedia) {
    return null;
  }

  const stream = await navigator.mediaDevices.getDisplayMedia({
    video: { displaySurface: "browser" },
    audio: false,
  } as DisplayMediaStreamOptions);

  const video = document.createElement("video");
  video.srcObject = stream;
  await video.play();

  await new Promise((resolve) => {
    video.onloadeddata = resolve;
  });

  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  }

  stream.getTracks().forEach((track) => track.stop());

  return canvas.toDataURL("image/png");
}

export function BetaFeedbackWidget() {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [captureError, setCaptureError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    startConsoleCapture();
  }, []);

  const userAgent = useMemo(
    () => (typeof navigator === "undefined" ? "unknown" : navigator.userAgent),
    []
  );

  useEffect(() => {
    if (!open) return;
    if (screenshot || isCapturing) return;

    const runCapture = async () => {
      setCaptureError(null);
      setIsCapturing(true);
      try {
        const dataUrl = await captureScreenshot();
        if (dataUrl) {
          setScreenshot(dataUrl);
        } else {
          setCaptureError("Screen capture is not available in this browser.");
        }
      } catch (error) {
        setCaptureError(
          error instanceof Error
            ? error.message
            : "Unable to capture a screenshot. Please try again."
        );
      } finally {
        setIsCapturing(false);
      }
    };

    void runCapture();
  }, [open, screenshot, isCapturing]);

  const handleSubmit = async () => {
    const logs = getConsoleLogs().slice(-100);
    const payload: FeedbackPayload = {
      message,
      screenshot,
      userAgent,
      consoleLogs: logs,
      tags: [FEEDBACK_TAG],
      createdAt: new Date().toISOString(),
    };

    setIsSubmitting(true);
    analyticsClient.trackWorkflowEvent("beta_feedback_submitted", "support", {
      has_screenshot: Boolean(screenshot),
      log_count: logs.length,
      tags: payload.tags,
    });

    try {
      await fetch("/api/feedback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
    } catch (error) {
      console.warn("Feedback submission failed", error);
    } finally {
      setIsSubmitting(false);
      setMessage("");
      setScreenshot(null);
      setOpen(false);
    }
  };

  const handleRecapture = async () => {
    setCaptureError(null);
    setIsCapturing(true);
    try {
      const dataUrl = await captureScreenshot();
      if (dataUrl) {
        setScreenshot(dataUrl);
      } else {
        setCaptureError("Screen capture is not available in this browser.");
      }
    } catch (error) {
      setCaptureError(
        error instanceof Error
          ? error.message
          : "Unable to capture a screenshot. Please try again."
      );
    } finally {
      setIsCapturing(false);
    }
  };

  return (
    <>
      <Button
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full shadow-lg"
        onClick={() => setOpen(true)}
        aria-label="Send beta feedback"
      >
        <MessageSquareText className="h-4 w-4" />
        Beta Feedback
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Send Beta Feedback</DialogTitle>
            <DialogDescription>
              Share your feedback with our beta team. We automatically attach a screenshot, browser
              details, and recent console logs.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="feedback-message">Feedback</Label>
                <Textarea
                  id="feedback-message"
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  placeholder="Describe the issue or idea..."
                  className="min-h-[180px]"
                />
              </div>
              <div className="rounded-lg border border-border bg-muted/50 p-3 text-xs text-muted-foreground">
                <div className="font-medium text-foreground">Browser</div>
                <p className="mt-1 break-words">{userAgent}</p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-foreground">Screenshot</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRecapture}
                  disabled={isCapturing}
                >
                  <Camera className="mr-2 h-4 w-4" />
                  {isCapturing ? "Capturing..." : "Recapture"}
                </Button>
              </div>
              <div className="flex min-h-[180px] items-center justify-center rounded-lg border border-dashed border-border bg-muted/30">
                {screenshot ? (
                  <img
                    src={screenshot}
                    alt="Captured screenshot"
                    className="max-h-[200px] w-full rounded-lg object-contain"
                  />
                ) : (
                  <div className="text-xs text-muted-foreground">
                    {isCapturing ? "Capturing screenshot..." : "No screenshot available."}
                  </div>
                )}
              </div>
              {captureError && (
                <p className="text-xs text-red-500">{captureError}</p>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!message.trim()}
              loading={isSubmitting}
            >
              {!isSubmitting && <Send className="mr-2 h-4 w-4" />}
              {isSubmitting ? "Sending..." : "Submit Feedback"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
