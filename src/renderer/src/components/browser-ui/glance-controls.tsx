import { useCallback } from "react";
import { motion } from "motion/react";
import { AppWindow, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { PortalComponent } from "@/components/portal/portal";
import { useBoundingRect } from "@/hooks/use-bounding-rect";
import { useTabsGroups } from "@/components/providers/tabs-provider";

const CONTROLS_WIDTH = 220;
const CONTROLS_HEIGHT = 40;
const CONTROLS_TOP_PADDING = 8;

interface GlanceControlsProps {
  anchorRef: React.RefObject<HTMLDivElement | null>;
}

/**
 * Floating chrome for an active glance popup: a dimming scrim over the back
 * tab (click to dismiss) and a pill with "Open as Tab" / close buttons above
 * the front tab. Both render through portals because the glance tabs are
 * WebContentsViews stacked over the browser UI — the scrim sits between the
 * two tab layers, the pill above both (see zIndexes in ~/layers).
 */
export function GlanceControls({ anchorRef }: GlanceControlsProps) {
  const { activeTabGroup } = useTabsGroups();
  const anchorRect = useBoundingRect(anchorRef);

  const glanceGroupId = activeTabGroup?.mode === "glance" ? activeTabGroup.id : null;

  const handlePromote = useCallback(() => {
    if (glanceGroupId) flow.tabs.glancePromote(glanceGroupId);
  }, [glanceGroupId]);

  const handleDismiss = useCallback(() => {
    if (glanceGroupId) flow.tabs.glanceDismiss(glanceGroupId);
  }, [glanceGroupId]);

  if (!glanceGroupId || !anchorRect) return null;

  const scrimStyle: React.CSSProperties = {
    top: anchorRect.y,
    left: anchorRect.x,
    width: anchorRect.width,
    height: anchorRect.height
  };

  const controlsStyle: React.CSSProperties = {
    top: anchorRect.y + CONTROLS_TOP_PADDING,
    left: anchorRect.x + (anchorRect.width - CONTROLS_WIDTH) / 2,
    width: CONTROLS_WIDTH,
    height: CONTROLS_HEIGHT
  };

  return (
    <>
      <PortalComponent layerType="glanceScrim" className="fixed" style={scrimStyle}>
        {/* Click outside the front tab dismisses the glance */}
        <motion.div
          className="w-full h-full bg-black/30"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.15 }}
          onClick={handleDismiss}
        />
      </PortalComponent>

      <PortalComponent layerType="glanceControls" className="fixed" style={controlsStyle}>
        <motion.div
          className={cn(
            "w-full h-full",
            "flex items-center justify-center gap-1 px-1.5",
            "bg-neutral-900/95 backdrop-blur-md",
            "border border-white/10 rounded-full"
          )}
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.15, ease: "easeOut" }}
        >
          <button
            onClick={handlePromote}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1 rounded-full",
              "text-sm text-white/80",
              "hover:bg-white/10 hover:text-white",
              "transition-colors duration-150"
            )}
            title="Open as a full tab"
          >
            <AppWindow size={15} />
            Open as Tab
          </button>

          <button
            onClick={handleDismiss}
            className={cn(
              "p-1.5 rounded-full text-white/70",
              "hover:bg-white/10 hover:text-white",
              "transition-colors duration-150"
            )}
            title="Close (Esc)"
          >
            <X size={16} />
          </button>
        </motion.div>
      </PortalComponent>
    </>
  );
}
