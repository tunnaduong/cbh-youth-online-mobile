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
import { getHomePosts } from "../../../services/api/Api";
import PostItem from "../../../components/PostItem";

const HomeScreen = () => {
  const [feed, setFeed] = React.useState(null);
  const [refreshing, setRefreshing] = React.useState(false);
  const [hasMore, setHasMore] = React.useState(true);
  const [currentPage, setCurrentPage] = React.useState(2);
  const flatListRef = React.useRef(null);

  const handleFetchFeed = async (page = 1) => {
    try {
      const response = await getHomePosts(page);
      setFeed(response.data.data);
    } catch (error) {
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
          keyExtractor={(item, index) => `key-${item.id}`}
          contentContainerStyle={{ paddingBottom: 30 }}
          renderItem={({ item, index }) => (
            <PostItem item={item} onExpand={() => handleExpandPost(index)} />
          )}
          onEndReached={onEndReached}
          onEndReachedThreshold={0.2}
          refreshControl={
            <RefreshControl
              colors={["#9Bd35A", "#689F38"]}
              refreshing={refreshing}
              onRefresh={async () => {
                setRefreshing(true);
                handleFetchFeed();
                setHasMore(true);
                setCurrentPage(2);
                setTimeout(() => {
                  setRefreshing(false);
                }, 1000);
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
