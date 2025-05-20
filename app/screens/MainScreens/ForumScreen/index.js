import React, { useContext, useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Image,
} from "react-native";
import FastImage from "react-native-fast-image";
import { AuthContext } from "../../../contexts/AuthContext";
import { getForumCategories } from "../../../services/api/Api";
import CustomLoading from "../../../components/CustomLoading";

export default function ForumScreen({ navigation }) {
  const [activeCategory, setActiveCategory] = useState(1);
  const { username } = useContext(AuthContext);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [forumSections, setForumSections] = useState([]);

  const fetchForumData = async () => {
    try {
      const response = await getForumCategories();
      setCategories(response.data);
      setForumSections(response.data[0].subforums);
      setLoading(false);
    } catch (error) {
      console.log(error);
    }
  };

  const handleActiveCategory = (categoryId) => {
    setActiveCategory(categoryId);
    setForumSections(categories.find((cat) => cat.id === categoryId).subforums);
  };

  useEffect(() => {
    fetchForumData();
  }, []);

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginHorizontal: 16,
            height: 50,
          }}
        >
          <Text
            style={{
              fontSize: 28,
              fontWeight: "bold",
              color: "#319527",
              flex: 1,
            }}
          >
            Diễn đàn
          </Text>
          {/* Avatar (replace with your user's avatar) */}
          <TouchableOpacity
            onPress={() => navigation.navigate("ProfileScreen", { username })}
          >
            <FastImage
              source={{
                uri: `https://api.chuyenbienhoa.com/v1.0/users/${username}/avatar`,
              }}
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                borderWidth: 2,
                borderColor: "#fff",
              }}
            />
          </TouchableOpacity>
        </View>
        <View
          style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
        >
          <CustomLoading />
          <Text style={{ marginTop: 15 }}>Đang tải diễn đàn...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
      {/* Header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          marginHorizontal: 16,
          height: 50,
        }}
      >
        <Text
          style={{
            fontSize: 28,
            fontWeight: "bold",
            color: "#319527",
            flex: 1,
          }}
        >
          Diễn đàn
        </Text>
        {/* Avatar (replace with your user's avatar) */}
        <TouchableOpacity
          onPress={() => navigation.navigate("ProfileScreen", { username })}
        >
          <FastImage
            source={{
              uri: `https://api.chuyenbienhoa.com/v1.0/users/${username}/avatar`,
            }}
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              borderWidth: 2,
              borderColor: "#fff",
            }}
          />
        </TouchableOpacity>
      </View>
      <View>
        {/* Category Tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginTop: 10, marginBottom: 10, marginHorizontal: 16 }}
        >
          {categories.map((cat) => (
            <TouchableOpacity
              key={`cat-${cat.id}`}
              onPress={() => handleActiveCategory(cat.id)}
              style={[
                styles.tab,
                activeCategory === cat.id && styles.tabActive,
              ]}
            >
              <Text
                style={[
                  styles.tabText,
                  activeCategory === cat.id && styles.tabTextActive,
                ]}
              >
                {cat.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 20 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Forum Sections */}
        <View style={{ marginHorizontal: 16 }}>
          {forumSections.map((section) => (
            <View key={section.id} style={styles.sectionBox}>
              <Text style={styles.sectionTitle}>{section.name}</Text>
              <View style={styles.sectionStats}>
                <Text style={styles.statText}>
                  Bài viết:{" "}
                  <Text style={styles.statBold}>{section.post_count}</Text>
                </Text>
                <Text style={styles.statText}>
                  Bình luận:{" "}
                  <Text style={styles.statBold}>{section.comment_count}</Text>
                </Text>
              </View>
              <View style={styles.latestBox}>
                {section.latest_post ? (
                  <>
                    <View style={{ flexDirection: "row", gap: 10 }}>
                      <Text style={styles.latestLabel}>Mới nhất</Text>
                      <Text style={styles.latestTime}>
                        {section.latest_post.created_at}
                      </Text>
                    </View>
                    <Text style={styles.latestContent}>
                      <Text style={styles.latestAuthor}>
                        {section.latest_post.user.name}:
                      </Text>{" "}
                      {section.latest_post.title}
                    </Text>
                  </>
                ) : (
                  <Text style={styles.latestLabel}>Chưa có bài viết mới</Text>
                )}
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: "#F3FDF1",
    marginRight: 7,
  },
  tabActive: {
    backgroundColor: "#C7F0C2",
  },
  tabText: {
    color: "#222",
    fontWeight: "500",
    fontSize: 15,
  },
  tabTextActive: {
    color: "#319527",
    fontWeight: "bold",
  },
  sectionBox: {
    borderWidth: 1,
    borderColor: "#319527",
    borderRadius: 10,
    padding: 10,
    marginBottom: 16,
    backgroundColor: "#fff",
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "bold",
    color: "#319527",
    marginBottom: 6,
  },
  sectionStats: {
    flexDirection: "row",
    marginBottom: 8,
    gap: 18,
  },
  statText: {
    fontSize: 14,
    color: "#222",
  },
  statBold: {
    fontWeight: "bold",
    color: "#222",
  },
  latestBox: {
    backgroundColor: "#F3FDF1",
    borderRadius: 6,
    padding: 8,
    marginTop: 2,
  },
  latestLabel: {
    fontSize: 13,
    color: "#888",
    fontWeight: "bold",
    marginBottom: 2,
  },
  latestContent: {
    fontSize: 14,
    color: "#222",
    marginBottom: 2,
  },
  latestAuthor: {
    fontWeight: "bold",
    color: "#319527",
  },
  latestTime: {
    fontSize: 12,
    color: "#888",
    marginLeft: "auto",
  },
});
