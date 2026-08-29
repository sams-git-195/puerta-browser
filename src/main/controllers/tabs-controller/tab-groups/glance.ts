import { Input, WebContents } from "electron";
import { BaseTabGroup } from "./index";
import type { Tab } from "../tab";

export class GlanceTabGroup extends BaseTabGroup {
  public frontTabId: number = -1;
  public mode: "glance" = "glance" as const;

  private escListenerCleanups: (() => void)[] = [];

  constructor(...args: ConstructorParameters<typeof BaseTabGroup>) {
    super(...args);

    this.on("tab-removed", () => {
      if (this.tabIds.length < 2) {
        // A glance tab group needs a source tab and at least one popup tab
        this.destroy();
        return;
      }
      // Keep the front-tab invariant: if the front tab left the group
      // (or was never restored), fall back to the most recent member.
      if (!this.tabIds.includes(this.frontTabId)) {
        this.setFrontTab(this.tabIds[this.tabIds.length - 1]);
      }
    });

    // Escape closes the glance popup. Key events go to the focused page's
    // webContents (not the browser UI), so intercept them main-side on every
    // member tab. Initial tabs were added in the base constructor, before
    // this subscription existed, so attach to them directly.
    for (const tab of this.tabs) {
      this.attachEscListener(tab);
    }
    this.on("tab-added", (tabId) => {
      const tab = this.tabsController.getTabById(tabId);
      if (tab) this.attachEscListener(tab);
    });
    this.on("destroyed", () => {
      for (const cleanup of this.escListenerCleanups) {
        cleanup();
      }
      this.escListenerCleanups = [];
    });
  }

  public setFrontTab(tabId: number) {
    this.frontTabId = tabId;
    this.emit("changed");
  }

  /**
   * The tab currently shown as the glance popup. Falls back to the most
   * recent member when frontTabId is stale (e.g. a restore that couldn't
   * resolve the persisted front tab).
   */
  public getFrontTab() {
    const front = this.tabsController.getTabById(this.frontTabId);
    if (front && this.tabIds.includes(front.id)) return front;
    const lastId = this.tabIds[this.tabIds.length - 1];
    return lastId !== undefined ? this.tabsController.getTabById(lastId) : null;
  }

  /**
   * Promote the glance popup to a normal tab: the group dissolves and both
   * tabs live on as standalone tabs, with the (former) front tab active.
   */
  public promote() {
    const frontTab = this.getFrontTab();
    this.destroy();
    if (frontTab && !frontTab.isDestroyed) {
      this.tabsController.activateTab(frontTab);
    }
  }

  /**
   * Dismiss the glance popup: the front tab is closed. With only one tab
   * left the group dissolves and the source tab is re-activated; with more
   * (stacked glances) the previous popup becomes the front.
   */
  public dismiss() {
    const frontTab = this.getFrontTab();
    if (!frontTab) {
      // Degenerate group with no resolvable members — just dissolve it.
      this.destroy();
      return;
    }
    const backTab = this.tabs.find((tab) => tab.id !== frontTab.id) ?? null;

    frontTab.destroy();
    if (this.isDestroyed && backTab && !backTab.isDestroyed) {
      this.tabsController.activateTab(backTab);
    }
  }

  private attachEscListener(tab: Tab) {
    const webContents: WebContents | null = tab.webContents;
    if (!webContents || webContents.isDestroyed()) return;

    const onBeforeInput = (_event: Electron.Event, input: Input) => {
      if (this.isDestroyed) return;
      if (input.type !== "keyDown" || input.key !== "Escape") return;
      if (input.alt || input.control || input.meta || input.shift) return;
      // In HTML fullscreen (e.g. video), Esc means "exit fullscreen" —
      // closing the popup instead would read as data loss.
      if (tab.fullScreen) return;
      // Defer: destroying a webContents from inside its own input event is unsafe
      setImmediate(() => {
        if (this.isDestroyed) return;
        try {
          this.dismiss();
        } catch (error) {
          // Never let this escape — an uncaught error here takes down the app
          console.error("glance: dismiss via Escape failed:", error);
        }
      });
    };

    webContents.on("before-input-event", onBeforeInput);
    this.escListenerCleanups.push(() => {
      if (!webContents.isDestroyed()) {
        webContents.off("before-input-event", onBeforeInput);
      }
    });
  }
}
