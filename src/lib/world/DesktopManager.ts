class DesktopManager {
    private readonly desktops: Map<string, Desktop>; // key is activityId|desktopId|screenName
    private kwinActivities: Set<string>;
    private kwinDesktops: Set<KwinDesktop>;
    private kwinScreens: Set<Output>;

    constructor(
        private readonly pinManager: PinManager,
        private readonly config: Desktop.Config,
        private readonly layoutConfig: LayoutConfig,
        private readonly focusPasser: FocusPassing.Passer,
        private readonly desktopFilter: DesktopFilter,
    ) {
        this.pinManager = pinManager;
        this.config = config;
        this.layoutConfig = layoutConfig;
        this.desktops = new Map();
        this.kwinActivities = new Set(Workspace.activities);
        this.kwinDesktops = new Set(Workspace.desktops);
        this.kwinScreens = new Set(Workspace.screens);
    }

    public getDesktop(activity: string, kwinDesktop: KwinDesktop, screen: Output) {
        if (!this.desktopFilter.shouldWorkOnDesktop(kwinDesktop)) {
            return undefined;
        }
        const desktopKey = DesktopManager.getDesktopKey(activity, kwinDesktop, screen);
        const desktop = this.desktops.get(desktopKey);
        if (desktop !== undefined) {
            return desktop;
        } else {
            return this.addDesktop(activity, kwinDesktop, screen);
        }
    }

    public getCurrentDesktop() {
        return this.getDesktop(Workspace.currentActivity, Workspace.currentDesktop, Workspace.activeScreen);
    }

    public getDesktopInCurrentActivity(kwinDesktop: KwinDesktop, screen: Output) {
        return this.getDesktop(Workspace.currentActivity, kwinDesktop, screen);
    }

    public getDesktopForClient(kwinClient: KwinClient) {
        if (kwinClient.activities.length !== 1 || kwinClient.desktops.length !== 1) {
            return undefined;
        }
        return this.getDesktop(kwinClient.activities[0], kwinClient.desktops[0], kwinClient.output);
    }

    private addDesktop(activity: string, kwinDesktop: KwinDesktop, screen: Output) {
        const desktopKey = DesktopManager.getDesktopKey(activity, kwinDesktop, screen);
        const desktop = new Desktop(
            kwinDesktop,
            this.pinManager,
            this.config,
            screen,
            this.layoutConfig,
            this.focusPasser,
        );
        this.desktops.set(desktopKey, desktop);
        return desktop;
    }

    private static getDesktopKey(activity: string, kwinDesktop: KwinDesktop, screen: Output) {
        return activity + "|" + kwinDesktop.id + "|" + screen.name;
    }

    public updateActivities() {
        const newActivities = new Set(Workspace.activities);
        for (const activity of this.kwinActivities) {
            if (!newActivities.has(activity)) {
                this.removeActivity(activity);
            }
        }
        this.kwinActivities = newActivities;
    }

    public updateDesktops() {
        const newDesktops = new Set(Workspace.desktops);
        for (const desktop of this.kwinDesktops) {
            if (!newDesktops.has(desktop)) {
                this.removeKwinDesktop(desktop);
            }
        }
        this.kwinDesktops = newDesktops;
    }

    public updateScreens() {
        const newScreens = new Set(Workspace.screens);
        for (const screen of this.kwinScreens) {
            if (!newScreens.has(screen)) {
                this.removeScreen(screen);
            }
        }
        this.kwinScreens = newScreens;
    }

    private removeActivity(activity: string) {
        for (const kwinDesktop of this.kwinDesktops) {
            for (const screen of this.kwinScreens) {
                this.destroyDesktop(activity, kwinDesktop, screen);
            }
        }
    }

    private removeKwinDesktop(kwinDesktop: KwinDesktop) {
        for (const activity of this.kwinActivities) {
            for (const screen of this.kwinScreens) {
                this.destroyDesktop(activity, kwinDesktop, screen);
            }
        }
    }

    private removeScreen(screen: Output) {
        for (const activity of this.kwinActivities) {
            for (const kwinDesktop of this.kwinDesktops) {
                this.destroyDesktop(activity, kwinDesktop, screen);
            }
        }
    }

    private destroyDesktop(activity: string, kwinDesktop: KwinDesktop, screen: Output) {
        const desktopKey = DesktopManager.getDesktopKey(activity, kwinDesktop, screen);
        const desktop = this.desktops.get(desktopKey);
        if (desktop !== undefined) {
            desktop.destroy();
            this.desktops.delete(desktopKey);
        }
    }

    public destroy() {
        for (const desktop of this.desktops.values()) {
            desktop.destroy();
        }
    }

    public *getAllDesktops() {
        for (const desktop of this.desktops.values()) {
            yield desktop;
        }
    }

    public *getDesktopsOnCurrentDesktopAndActivity() {
        const activity = Workspace.currentActivity;
        const kwinDesktop = Workspace.currentDesktop;
        for (const screen of this.kwinScreens) {
            const desktopKey = DesktopManager.getDesktopKey(activity, kwinDesktop, screen);
            const desktop = this.desktops.get(desktopKey);
            if (desktop !== undefined) {
                yield desktop;
            }
        }
    }

    public getDesktopsForClient(kwinClient: KwinClient) {
        const desktops = this.getDesktops(kwinClient.activities, kwinClient.desktops); // workaround for QTBUG-109880
        return desktops;
    }

    // empty array means all
    public *getDesktops(activities: string[], kwinDesktops: KwinDesktop[]) {
        const matchedActivities = activities.length > 0 ? activities : this.kwinActivities.keys();
        const matchedDesktops = kwinDesktops.length > 0 ? kwinDesktops : this.kwinDesktops.keys();
        for (const matchedActivity of matchedActivities) {
            for (const matchedDesktop of matchedDesktops) {
                for (const screen of this.kwinScreens) {
                    const desktopKey = DesktopManager.getDesktopKey(matchedActivity, matchedDesktop, screen);
                    const desktop = this.desktops.get(desktopKey);
                    if (desktop !== undefined) {
                        yield desktop;
                    }
                }
            }
        }
    }
}
