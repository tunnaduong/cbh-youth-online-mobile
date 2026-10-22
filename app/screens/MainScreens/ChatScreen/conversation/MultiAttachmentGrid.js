import { View, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import FastImage from "../../../../components/FastImage";
import { resolveMediaUrl } from "./chatUtils";
import { styles } from "./styles";

// Renders a compact grid of thumbnails for a multi-attachment message
// (item.file_urls with 2+ entries). Images show the actual thumbnail;
// videos don't have a per-item thumbnail from the backend so they fall back
// to the same placeholder box used for a single video, with a play icon
// overlay per cell. Tapping a cell hands the tapped index back to the
// caller so it can open the right viewer (gallery-swipe for images, single
// video viewer for videos).
const MultiAttachmentGrid = ({ urls, isVideo, onPressItem }) => {
  const items = urls.slice(0, 10);
  const columns = items.length <= 4 ? 2 : 3;
  const gap = 2;
  const cellSize = (200 - gap * (columns - 1)) / columns;
  return (
    <View style={{ width: 200, flexDirection: "row", flexWrap: "wrap", gap }}>
      {items.map((url, idx) => (
        <TouchableOpacity
          key={idx}
          activeOpacity={0.85}
          onPress={() => onPressItem(idx)}
          style={{ width: cellSize, height: cellSize }}
        >
          {isVideo ? (
            <View style={[styles.videoPlaceholder, { width: "100%", height: "100%", borderRadius: 6 }]} />
          ) : (
            <FastImage
              source={{ uri: resolveMediaUrl(url) }}
              style={{ width: "100%", height: "100%", borderRadius: 6 }}
              resizeMode="cover"
            />
          )}
          {isVideo && (
            <View style={[styles.videoPlayOverlay, { borderRadius: 6 }]}>
              <Ionicons name="play" size={16} color="#fff" />
            </View>
          )}
        </TouchableOpacity>
      ))}
    </View>
  );
};

export { MultiAttachmentGrid };
