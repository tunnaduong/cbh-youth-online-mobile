import React, { useContext } from "react";
import {
  View,
  Text,
  StyleSheet,
  Button,
  Animated,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  FlatList,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AuthContext } from "../../../contexts/AuthContext";
import { getHomePosts, incrementPostView } from "../../../services/api/Api";
import PostItem from "../../../components/PostItem";

const HomeScreen = ({ navigation }) => {
  const [feed, setFeed] = React.useState(null);
  const [refreshing, setRefreshing] = React.useState(false);
  const [hasMore, setHasMore] = React.useState(true);
  const [currentPage, setCurrentPage] = React.useState(2);
  const viewedPosts = React.useRef(new Set());
  const flatListRef = React.useRef(null);

  const handleFetchFeed = async (page = 1) => {
    try {
      const response = await getHomePosts(page);
      setRefreshing(false);
      setFeed(response.data.data);
    } catch (error) {
      setRefreshing(false);
      console.error("Error fetching newsfeed:", error);
    }
  };

  React.useEffect(() => {
    handleFetchFeed();
  }, []);

  const onEndReached = () => {
    if (!hasMore) return;

    getHomePosts(currentPage).then((response) => {
      if (response.data.data.length === 0) {
        setHasMore(false);
        return;
      }
      setFeed((prevData) => {
        return [...prevData, ...response.data.data];
      });
      setCurrentPage((prevPage) => prevPage + 1);
    });
  };

  const ListEndLoader = () => {
    if (hasMore) {
      return (
        <View style={{ marginTop: 40 }}>
          <ActivityIndicator />
        </View>
      );
    }
  };

  const handleExpandPost = (index) => {
    if (flatListRef.current) {
      flatListRef.current.scrollToIndex({
        index,
        animated: false,
      });
    }
  };

  const handleVoteUpdate = (postId, newVotes) => {
    setFeed((prevFeed) =>
      prevFeed.map((post) =>
        post.id === postId ? { ...post, votes: newVotes } : post
      )
    );
  };

  const handleSaveUpdate = (postId, savedStatus) => {
    setFeed((prevFeed) =>
      prevFeed.map((post) =>
        post.id === postId ? { ...post, saved: savedStatus } : post
      )
    );
  };

  const handleViewableItemsChanged = ({ viewableItems }) => {
    viewableItems.forEach((viewableItem) => {
      const postId = viewableItem.item.id;

      if (!viewedPosts.current.has(postId)) {
        viewedPosts.current.add(postId); // Mark as viewed
        increasePostView(postId); // Call API
      }
    });
  };

  const increasePostView = async (postId) => {
    try {
      await incrementPostView(postId);
    } catch (error) {
      console.error("Failed to increase view:", error);
    }
  };

  return feed == null ? (
    <View
      style={{
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "white",
        flex: 1,
      }}
    >
      <ActivityIndicator size={"large"} color="#636568" />
      <Text style={{ marginTop: 15 }}>Đang tải bảng tin...</Text>
    </View>
  ) : (
    <>
      <View style={{ backgroundColor: "white", flex: 1 }}>
        <FlatList
          ref={flatListRef}
          showsVerticalScrollIndicator={false}
          data={feed}
          keyExtractor={(item, index) => `key-${item.id + "-" + index}`}
          contentContainerStyle={{ paddingBottom: 30 }}
          renderItem={({ item, index }) => (
            <PostItem
              item={item}
              onExpand={() => handleExpandPost(index)}
              onVoteUpdate={handleVoteUpdate}
              onSaveUpdate={handleSaveUpdate}
              navigation={navigation}
            />
          )}
          onEndReached={onEndReached}
          onEndReachedThreshold={0.2}
          onViewableItemsChanged={handleViewableItemsChanged}
          viewabilityConfig={{ itemVisiblePercentThreshold: 50 }}
          refreshControl={
            <RefreshControl
              colors={["#9Bd35A", "#689F38"]}
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                handleFetchFeed();
                setHasMore(true);
                setCurrentPage(2);
                viewedPosts.current = new Set(); // Reset viewed posts
              }}
            />
          }
          ListFooterComponent={ListEndLoader}
        />
      </View>
    </>
  );
};

export default HomeScreen;
