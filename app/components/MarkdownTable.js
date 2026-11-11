import React from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { TNodeChildrenRenderer } from "react-native-render-html";
import { useTheme } from "../contexts/ThemeContext";

// react-native-render-html draws <table> as a stack of plain blocks, so a
// markdown table's cells ran together as one paragraph. This draws the grid
// itself: equal columns that fill the post, wider than the screen only when
// there are too many to read, then the table scrolls sideways.
const MIN_COLUMN_WIDTH = 104;

function collectRows(tnode, rows = []) {
  for (const child of tnode.children || []) {
    if (child.tagName === "tr") {
      rows.push((child.children || []).filter((c) => c.tagName === "td" || c.tagName === "th"));
    } else {
      collectRows(child, rows);
    }
  }
  return rows;
}

export function TableRenderer({ tnode, sharedProps }) {
  const { theme } = useTheme();
  const rows = collectRows(tnode).filter((r) => r.length > 0);
  if (rows.length === 0) return null;

  const columns = Math.max(...rows.map((r) => r.length));
  const available = sharedProps?.contentWidth || 0;
  const columnWidth = Math.max(MIN_COLUMN_WIDTH, Math.floor(available / columns));

  return (
    <ScrollView
      horizontal
      nestedScrollEnabled
      showsHorizontalScrollIndicator={false}
      style={styles.scroll}
    >
      <View style={[styles.table, { borderColor: theme.border }]}>
        {rows.map((cells, rowIndex) => (
          <View
            key={rowIndex}
            style={[
              styles.row,
              rowIndex > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border },
            ]}
          >
            {Array.from({ length: columns }).map((_, colIndex) => {
              const cell = cells[colIndex];
              const isHeader = cell?.tagName === "th";
              return (
                <View
                  key={colIndex}
                  style={[
                    styles.cell,
                    { width: columnWidth },
                    colIndex > 0 && { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: theme.border },
                    isHeader && { backgroundColor: theme.iconBackground },
                  ]}
                >
                  {cell ? <TNodeChildrenRenderer tnode={cell} /> : null}
                </View>
              );
            })}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

export const tableRenderers = { table: TableRenderer };

const styles = StyleSheet.create({
  scroll: { marginVertical: 8 },
  table: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    overflow: "hidden",
  },
  row: { flexDirection: "row" },
  cell: { paddingHorizontal: 10, paddingVertical: 8, justifyContent: "center" },
});
