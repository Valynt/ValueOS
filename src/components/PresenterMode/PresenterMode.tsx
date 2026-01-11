/**
 * PresenterMode Component
 *
 * High-prestige design variant for presentations.
 * Features larger typography, simplified UI, and export-ready layouts.
 */

import { useState, useEffect, useCallback } from "react";
import { Maximize2, Minimize2, ChevronLeft, ChevronRight, Download, Share2, X } from "lucide-react";
import { cn } from "../../lib/utils";

interface Slide {
  id: string;
  title: string;
  content: React.ReactNode;
  notes?: string;
}

interface PresenterModeProps {
  slides: Slide[];
  title?: string;
  subtitle?: string;
  onExit?: () => void;
  onExport?: () => void;
  onShare?: () => void;
  className?: string;
}

export function PresenterMode({
  slides,
  title,
  subtitle,
  onExit,
  onExport,
  onShare,
  className,
}: PresenterModeProps) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [showNotes, setShowNotes] = useState(false);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case "ArrowRight":
        case " ":
        case "Enter":
          e.preventDefault();
          nextSlide();
          break;
        case "ArrowLeft":
        case "Backspace":
          e.preventDefault();
          prevSlide();
          break;
        case "Escape":
          if (isFullscreen) {
            exitFullscreen();
          } else {
            onExit?.();
          }
          break;
        case "f":
        case "F":
          toggleFullscreen();
          break;
        case "n":
        case "N":
          setShowNotes((prev) => !prev);
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentSlide, isFullscreen, onExit]);

  // Auto-hide controls
  useEffect(() => {
    let timeout: NodeJS.Timeout;

    const handleMouseMove = () => {
      setShowControls(true);
      clearTimeout(timeout);
      timeout = setTimeout(() => setShowControls(false), 3000);
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      clearTimeout(timeout);
    };
  }, []);

  const nextSlide = useCallback(() => {
    setCurrentSlide((prev) => Math.min(prev + 1, slides.length - 1));
  }, [slides.length]);

  const prevSlide = useCallback(() => {
    setCurrentSlide((prev) => Math.max(prev - 1, 0));
  }, []);

  const toggleFullscreen = useCallback(async () => {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      await document.exitFullscreen();
      setIsFullscreen(false);
    }
  }, []);

  const exitFullscreen = useCallback(async () => {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
      setIsFullscreen(false);
    }
  }, []);

  const slide = slides[currentSlide];
  const progress = slides.length > 0 ? ((currentSlide + 1) / slides.length) * 100 : 0;

  if (!slide) {
    return (
      <div
        className={cn(
          "fixed inset-0 z-50 bg-gray-950 text-white",
          "flex items-center justify-center",
          className
        )}
      >
        <p className="text-white/60">No slides available</p>
      </div>
    );
  }

  return (
    <div className={cn("fixed inset-0 z-50 bg-gray-950 text-white", "flex flex-col", className)}>
      {/* Header - auto-hide */}
      <header
        className={cn(
          "absolute top-0 left-0 right-0 z-10",
          "flex items-center justify-between px-8 py-4",
          "bg-gradient-to-b from-gray-950/80 to-transparent",
          "transition-opacity duration-300",
          showControls ? "opacity-100" : "opacity-0"
        )}
      >
        <div>
          {title && <h1 className="text-xl font-semibold text-white/90">{title}</h1>}
          {subtitle && <p className="text-sm text-white/60">{subtitle}</p>}
        </div>

        <div className="flex items-center gap-2">
          {onShare && (
            <button
              onClick={onShare}
              className="p-2 rounded-lg hover:bg-white/10 text-white/70 hover:text-white transition-colors"
              aria-label="Share"
            >
              <Share2 className="w-5 h-5" />
            </button>
          )}
          {onExport && (
            <button
              onClick={onExport}
              className="p-2 rounded-lg hover:bg-white/10 text-white/70 hover:text-white transition-colors"
              aria-label="Export"
            >
              <Download className="w-5 h-5" />
            </button>
          )}
          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-lg hover:bg-white/10 text-white/70 hover:text-white transition-colors"
            aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
          >
            {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
          </button>
          {onExit && (
            <button
              onClick={onExit}
              className="p-2 rounded-lg hover:bg-white/10 text-white/70 hover:text-white transition-colors"
              aria-label="Exit presenter mode"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </header>

      {/* Main slide content */}
      <main className="flex-1 flex items-center justify-center px-16 py-24">
        <div className="w-full max-w-5xl">
          {/* Slide title */}
          <h2 className="text-5xl font-bold mb-8 text-center leading-tight">{slide.title}</h2>

          {/* Slide content */}
          <div className="text-2xl leading-relaxed text-white/80 text-center">{slide.content}</div>
        </div>
      </main>

      {/* Speaker notes panel */}
      {showNotes && slide.notes && (
        <div
          className={cn(
            "absolute bottom-24 left-8 right-8",
            "bg-gray-900/90 backdrop-blur-sm border border-gray-800 rounded-xl",
            "p-4 max-h-32 overflow-y-auto"
          )}
        >
          <p className="text-sm text-gray-400">{slide.notes}</p>
        </div>
      )}

      {/* Navigation controls - auto-hide */}
      <footer
        className={cn(
          "absolute bottom-0 left-0 right-0 z-10",
          "bg-gradient-to-t from-gray-950/80 to-transparent",
          "transition-opacity duration-300",
          showControls ? "opacity-100" : "opacity-0"
        )}
      >
        {/* Progress bar */}
        <div className="h-1 bg-gray-800">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="flex items-center justify-between px-8 py-4">
          {/* Slide navigation */}
          <div className="flex items-center gap-4">
            <button
              onClick={prevSlide}
              disabled={currentSlide === 0}
              className={cn(
                "p-3 rounded-full transition-colors",
                currentSlide === 0
                  ? "text-gray-600 cursor-not-allowed"
                  : "hover:bg-white/10 text-white/70 hover:text-white"
              )}
              aria-label="Previous slide"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>

            <span className="text-lg font-medium text-white/70">
              {currentSlide + 1} / {slides.length}
            </span>

            <button
              onClick={nextSlide}
              disabled={currentSlide === slides.length - 1}
              className={cn(
                "p-3 rounded-full transition-colors",
                currentSlide === slides.length - 1
                  ? "text-gray-600 cursor-not-allowed"
                  : "hover:bg-white/10 text-white/70 hover:text-white"
              )}
              aria-label="Next slide"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </div>

          {/* Slide dots */}
          <div className="flex items-center gap-2">
            {slides.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentSlide(index)}
                className={cn(
                  "w-2 h-2 rounded-full transition-all",
                  index === currentSlide ? "w-8 bg-primary" : "bg-gray-600 hover:bg-gray-500"
                )}
                aria-label={`Go to slide ${index + 1}`}
              />
            ))}
          </div>

          {/* Keyboard hints */}
          <div className="flex items-center gap-4 text-xs text-gray-500">
            <span>← → Navigate</span>
            <span>F Fullscreen</span>
            <span>N Notes</span>
            <span>Esc Exit</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

/**
 * Wrapper to convert any content into presenter-friendly slides
 */
export function createSlides(
  items: Array<{
    title: string;
    content: React.ReactNode;
    notes?: string;
  }>
): Slide[] {
  return items.map((item, index) => ({
    id: `slide-${index}`,
    ...item,
  }));
}

export default PresenterMode;
