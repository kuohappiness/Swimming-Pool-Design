export interface MountedView {
  destroy(): void | Promise<void>;
}

export interface ViewModule {
  mount(container: HTMLElement): MountedView | Promise<MountedView>;
}
