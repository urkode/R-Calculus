/* Roll-fed material calculation. The finished size is expanded by the outer
   trim allowance on every edge; overlap is counted once for every panel seam. */
globalThis.RollMaterial = Object.freeze({
  plan({ widthCm, heightCm, quantity = 1, rollWidthCm, edgeTrimCm = 0, seamOverlapCm = 0, orientation = 'vertical' }) {
    const finishedWidth = Number(widthCm) || 0;
    const finishedHeight = Number(heightCm) || 0;
    const copies = Math.max(0, Number(quantity) || 0);
    const rollWidth = Number(rollWidthCm) || 0;
    const edgeTrim = Math.max(0, Number(edgeTrimCm) || 0);
    const overlap = Math.max(0, Number(seamOverlapCm) || 0);
    if (!(finishedWidth > 0 && finishedHeight > 0 && copies > 0 && rollWidth > overlap)) return null;

    const cutWidth = finishedWidth + (edgeTrim * 2);
    const cutHeight = finishedHeight + (edgeTrim * 2);
    const makePlan = direction => {
      const across = direction === 'vertical' ? cutWidth : cutHeight;
      const along = direction === 'vertical' ? cutHeight : cutWidth;
      const panelsPerCopy = Math.max(1, Math.ceil((across - overlap) / (rollWidth - overlap)));
      const panelCount = panelsPerCopy * copies;
      const linearMeters = (panelCount * along) / 100;
      const purchasedAreaSqm = linearMeters * (rollWidth / 100);
      const finishedAreaSqm = (finishedWidth * finishedHeight * copies) / 10000;
      const wasteSqm = Math.max(0, purchasedAreaSqm - finishedAreaSqm);
      return {
        orientation: direction,
        panelsPerCopy,
        panelCount,
        linearMeters,
        purchasedAreaSqm,
        finishedAreaSqm,
        wasteSqm,
        wastePercent: purchasedAreaSqm ? (wasteSqm / purchasedAreaSqm) * 100 : 0,
        cutWidth,
        cutHeight,
        panelLengthCm: along,
        seams: Math.max(0, panelsPerCopy - 1) * copies
      };
    };
    const vertical = makePlan('vertical');
    const horizontal = makePlan('horizontal');
    if (orientation === 'horizontal') return horizontal;
    if (orientation === 'auto') return horizontal.linearMeters < vertical.linearMeters ? horizontal : vertical;
    return vertical;
  }
});
