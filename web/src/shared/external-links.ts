/**
 * Opens links that leave the site in a new window and says so to screen-reader users.
 * Only `http(s)` links inside `scope` are touched; in-site `./` and `?view=` links stay as they are.
 */
export function markExternalLinks(container: HTMLElement, scope: string): void {
  for (const link of container.querySelectorAll<HTMLAnchorElement>(`${scope} a[href^="http"]`)) {
    link.target = '_blank';
    link.rel = 'noopener';
    link.insertAdjacentHTML(
      'beforeend',
      '<span class="site-visually-hidden">（另開新視窗）</span>',
    );
  }
}
