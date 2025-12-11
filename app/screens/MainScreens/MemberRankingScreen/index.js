import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  SafeAreaView,
} from "react-native";
import { getMemberRanking } from "../../../services/api/Api";
import CustomLoading from "../../../components/CustomLoading";
import FastImage from "react-native-fast-image";
import Ionicons from "react-native-vector-icons/Ionicons";

export default function MemberRankingScreen({ navigation }) {
  const [rankingData, setRankingData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async () => {
    try {
      const response = await getMemberRanking(50); // Get top 50
      if (response && response.data) {
        setRankingData(response.data);
      } else if (Array.isArray(response)) {
        setRankingData(response);
      }
    } catch (error) {
      console.log("Error fetching rankings:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const renderTop3 = () => {
    if (rankingData.length < 3) return null;
    const [first, second, third] = rankingData;

    return (
      <View style={styles.top3Container}>
        {/* Second Place */}
        <TouchableOpacity
          style={[styles.top3Item, { marginTop: 40 }]}
          onPress={() =>
            navigation.navigate("ProfileScreen", { username: second.username })
          }
        >
          <View style={styles.rankBadge2}>
            <Text style={styles.rankText}>2</Text>
          </View>
          <FastImage
            source={{
              uri:
                second.avatar_url ||
                `https://api.chuyenbienhoa.com/v1.0/users/${second.username}/avatar`,
            }}
            style={styles.avatarTop2}
          />
          <Text style={styles.nameTop} numberOfLines={1}>
            {second.profile_name}
          </Text>
          <Text style={styles.pointsTop}>{second.total_points} điểm</Text>
        </TouchableOpacity>

        {/* First Place */}
        <TouchableOpacity
          style={styles.top3Item}
          onPress={() =>
            navigation.navigate("ProfileScreen", { username: first.username })
          }
        >
          <View style={styles.crownContainer}>
            <Ionicons name="trophy" size={24} color="#FFD700" />
          </View>
          <FastImage
            source={{
              uri:
                first.avatar_url ||
                `https://api.chuyenbienhoa.com/v1.0/users/${first.username}/avatar`,
            }}
            style={styles.avatarTop1}
          />
          <View style={styles.rankBadge1}>
            <Text style={styles.rankText}>1</Text>
          </View>
          <Text
            style={[
              styles.nameTop,
              { fontWeight: "bold", fontSize: 16, marginTop: 18 },
            ]}
            numberOfLines={1}
          >
            {first.profile_name}
          </Text>
          <Text style={styles.pointsTop}>{first.total_points} điểm</Text>
        </TouchableOpacity>

        {/* Third Place */}
        <TouchableOpacity
          style={[styles.top3Item, { marginTop: 40 }]}
          onPress={() =>
            navigation.navigate("ProfileScreen", { username: third.username })
          }
        >
          <View style={styles.rankBadge3}>
            <Text style={styles.rankText}>3</Text>
          </View>
          <FastImage
            source={{
              uri:
                third.avatar_url ||
                `https://api.chuyenbienhoa.com/v1.0/users/${third.username}/avatar`,
            }}
            style={styles.avatarTop2}
          />
          <Text style={styles.nameTop} numberOfLines={1}>
            {third.profile_name}
          </Text>
          <Text style={styles.pointsTop}>{third.total_points} điểm</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderItem = ({ item, index }) => {
    if (index < 3) return null; // Skip top 3, handled separately

    return (
      <TouchableOpacity
        style={styles.rankItem}
        onPress={() =>
          navigation.navigate("ProfileScreen", { username: item.username })
        }
      >
        <Text style={styles.rankNumber}>#{index + 1}</Text>
        <FastImage
          source={{
            uri:
              item.avatar_url ||
              `https://api.chuyenbienhoa.com/v1.0/users/${item.username}/avatar`,
          }}
          style={styles.itemAvatar}
        />
        <View style={styles.itemInfo}>
          <Text style={styles.itemName}>{item.profile_name}</Text>
          <Text style={styles.itemUsername}>@{item.username}</Text>
        </View>
        <Text style={styles.itemPoints}>{item.total_points} điểm</Text>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <CustomLoading />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Bảng xếp hạng</Text>
        <View style={{ width: 24 }} />
      </View>

      <FlatList
        data={rankingData}
        keyExtractor={(item) => item.username} // Use username as key if id is not guaranteed
        renderItem={renderItem}
        ListHeaderComponent={renderTop3}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
  },
  listContent: {
    paddingBottom: 20,
  },
  top3Container: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 30,
    marginBottom: 10,
    backgroundColor: "#F3FDF1", // Slight background for top area, matching forum theme
  },
  top3Item: {
    alignItems: "center",
    width: "30%",
  },
  avatarTop1: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    borderColor: "#FFD700",
    marginBottom: 8,
  },
  avatarTop2: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: "#C0C0C0", // Silver
    marginBottom: 8,
  },
  nameTop: {
    fontSize: 14,
    color: "#333",
    textAlign: "center",
    marginBottom: 2,
  },
  pointsTop: {
    fontSize: 13,
    fontWeight: "bold",
    color: "#319527",
  },
  crownContainer: {
    position: "absolute",
    top: -28,
    zIndex: 1,
  },
  rankBadge1: {
    position: "absolute",
    bottom: 45,
    backgroundColor: "#FFD700",
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
  rankBadge2: {
    position: "absolute",
    top: -10,
    zIndex: 1,
    backgroundColor: "#C0C0C0",
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
  rankBadge3: {
    position: "absolute",
    top: -10,
    zIndex: 1,
    backgroundColor: "#CD7F32",
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
  rankText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "bold",
  },
  rankItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  rankNumber: {
    width: 40,
    fontSize: 16,
    fontWeight: "600",
    color: "#888",
    textAlign: "center",
    marginRight: 10,
  },
  itemAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 12,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 15,
    fontWeight: "500",
    color: "#333",
  },
  itemUsername: {
    fontSize: 13,
    color: "#888",
  },
  itemPoints: {
    fontSize: 15,
    fontWeight: "bold",
    color: "#319527",
  },
});
