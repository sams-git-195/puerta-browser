import { BaseTabGroup } from "./index";

export class SplitTabGroup extends BaseTabGroup {
  public mode: "split" = "split" as const;

  constructor(...args: ConstructorParameters<typeof BaseTabGroup>) {
    super(...args);

    this.on("tab-removed", () => {
      if (this.tabIds.length < 2) {
        // A split needs at least two panes; the survivor becomes a normal tab
        this.destroy();
      }
    });
  }

  /**
   * The tab's column index within the split (left to right).
   * -1 when the tab is not a member.
   */
  public indexOfTab(tabId: number): number {
    return this.tabIds.indexOf(tabId);
  }

  public get tabCount(): number {
    return this.tabIds.length;
  }
}
