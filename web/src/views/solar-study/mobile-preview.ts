/**
 * 手機版預覽：把平面圖或剖面圖複製一份放到控制器上方。
 * 複製品不是第二張圖：拿掉無障礙名稱並隱藏，所有 id 加前綴，
 * 圖內 url(#…)、href="#…" 與 aria 參照跟著改，才不會和原圖的 id 重複。
 */
export function clonePreviewSvg(source: SVGSVGElement, idPrefix: string): SVGSVGElement {
  const clone = source.cloneNode(true) as SVGSVGElement;
  clone.removeAttribute('id');
  clone.removeAttribute('role');
  clone.removeAttribute('aria-labelledby');
  clone.removeAttribute('aria-describedby');
  clone.setAttribute('aria-hidden', 'true');
  clone.setAttribute('focusable', 'false');

  const idMap = new Map<string, string>();
  Array.from(clone.querySelectorAll<SVGElement>('[id]')).forEach((element) => {
    const oldId = element.id;
    const newId = idPrefix + '-' + oldId;
    idMap.set(oldId, newId);
    element.id = newId;
  });

  Array.from(clone.querySelectorAll<SVGElement>('*')).forEach((element) => {
    Array.from(element.attributes).forEach((attribute) => {
      let value = attribute.value;
      idMap.forEach((newId, oldId) => {
        value = value.replaceAll('url(#' + oldId + ')', 'url(#' + newId + ')');
        if (value === '#' + oldId) value = '#' + newId;
        if (attribute.name === 'aria-labelledby' || attribute.name === 'aria-describedby') {
          value = value
            .split(/\s+/)
            .map((token) => (token === oldId ? newId : token))
            .join(' ');
        }
      });
      if (value !== attribute.value) element.setAttribute(attribute.name, value);
    });
  });

  return clone;
}
