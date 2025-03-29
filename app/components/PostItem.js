import React, { useState } from "react";
import { View, Pressable, StyleSheet, Text, Image } from "react-native";
import Markdown from "react-native-markdown-display";
import Verified from "../assets/Verified";

const styles = StyleSheet.create({
  body: {
    paddingHorizontal: 15,
  },
  heading1: {
    fontSize: 25,
  },
  heading2: {
    fontSize: 20,
  },
  heading3: {
    fontSize: 18,
  },
  heading4: {
    fontSize: 16,
  },
  paragraph: {
    fontSize: 16,
  },
  strong: {
    fontSize: 16,
  },
  em: {
    fontSize: 16,
  },
  bullet_list: {
    fontSize: 16,
  },
  ordered_list: {
    fontSize: 16,
  },
  hr: {
    backgroundColor: "#e5e7eb",
    marginVertical: 15,
  },
});

const PostItem = ({ item, onExpand }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const handlePress = () => {
    setIsExpanded(!isExpanded);
    if (isExpanded && onExpand && item.content.length > 300) {
      onExpand(); // Notify the FlatList to adjust the scroll position
    }
  };

  const truncatedContent =
    item.content.length > 300
      ? `${item.content.substring(0, 300)}...`
      : item.content;

  return (
    <View
      style={{
        borderBottomWidth: 8,
        borderBottomColor: "#E6E6E6",
      }}
    >
      <Pressable onPress={handlePress}>
        <Text className="font-bold text-[21px] px-[15px] mt-[15px]">
          {item.title}
        </Text>
        <Markdown style={styles}>
          {isExpanded
            ? item.content.replace(/<br\s*\/?>/gi, "\n")
            : truncatedContent.replace(/<br\s*\/?>/gi, "\n")}
        </Markdown>
      </Pressable>
      {item.image_url != null && (
        <View className="bg-[#E4EEE3] my-2">
          <Image
            source={{ uri: "https://api.chuyenbienhoa.com" + item.image_url }}
            height={300}
            style={{ resizeMode: "contain" }}
          />
        </View>
      )}
      <View className="px-[15px] flex-row items-center mb-2">
        <View
          className="bg-white w-[42px] rounded-full overflow-hidden"
          style={{
            borderWidth: 1,
            borderColor: "#dee2e6",
          }}
        >
          <Image
            source={{
              uri: `https://api.chuyenbienhoa.com/v1.0/users/${item.author.username}/avatar`,
            }}
            style={{ width: 40, height: 40, borderRadius: 30 }}
          />
        </View>
        <Text className="font-bold text-[#319527] ml-2 shrink">
          {item.author.profile_name}
          {item.author.verified && (
            <View>
              <Verified
                width={15}
                height={15}
                color={"#319527"}
                style={{ marginBottom: -3 }}
              />
            </View>
          )}
        </Text>
        <Text> · 3 ngày trước</Text>
      </View>
    </View>
  );
};

export default PostItem;
