type ResponsiveTwoColumnLayoutOptions = {
  viewportWidth: number;
  totalHorizontalPadding: number;
  gap?: number;
  minItemWidth?: number;
};

type ResponsiveTwoColumnLayout = {
  columns: 1 | 2;
  availableWidth: number;
  itemWidth: number;
};

export function getResponsiveTwoColumnLayout({
  viewportWidth,
  totalHorizontalPadding,
  gap = 0,
  minItemWidth = 120,
}: ResponsiveTwoColumnLayoutOptions): ResponsiveTwoColumnLayout {
  const safeGap = Math.max(gap, 0);
  const availableWidth = Math.max(viewportWidth - totalHorizontalPadding, 0);
  const twoColumnWidth = Math.floor((availableWidth - safeGap) / 2);

  if (twoColumnWidth < minItemWidth) {
    return {
      columns: 1,
      availableWidth,
      itemWidth: availableWidth,
    };
  }

  return {
    columns: 2,
    availableWidth,
    itemWidth: twoColumnWidth,
  };
}
