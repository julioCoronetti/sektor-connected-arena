import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { FlatList, Text, TouchableOpacity, View } from "react-native";

import { AppHeader } from "../../components/ui/AppHeader";
import CommentsModal from "../../components/community/CommentsModal";
import { CreatePostModal } from "../../components/community/CreatePostModal";
import { PostCard } from "../../components/community/PostCard";
import { useCommunity } from "../../hooks/useCommunity";

export default function CommunityScreen() {
  const { posts, isLoading, hasMore, error, loadPosts, createPost, toggleLike } =
    useCommunity();
  const [showCreate, setShowCreate] = useState(false);
  const [activePostId, setActivePostId] = useState<string | null>(null);

  useEffect(() => {
    loadPosts(true);
  }, [loadPosts]);

  return (
    <View className="flex-1 bg-sektor-bg">
      <AppHeader paddingBottom={4} />

      {/* Divider */}
      <View className="h-px bg-sektor-border" />

      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <PostCard
            post={item}
            onLike={() => toggleLike(item.id, false)}
            onComment={() => setActivePostId(item.id)}
          />
        )}
        onRefresh={() => loadPosts(true)}
        refreshing={isLoading && posts.length === 0}
        contentContainerStyle={{ paddingBottom: 24 }}
        ListEmptyComponent={
          !isLoading ? (
            <View className="items-center py-16">
              <Ionicons name="chatbubbles-outline" size={40} color="#888888" />
              <Text className="mt-3 text-sektor-muted">
                {error ?? "Nenhum post ainda. Seja o primeiro!"}
              </Text>
            </View>
          ) : null
        }
        ListFooterComponent={
          hasMore && posts.length > 0 ? (
            <TouchableOpacity
              accessibilityRole="button"
              className="items-center py-4"
              onPress={() => loadPosts(false)}
            >
              <Text className="text-sektor-accent font-semibold">Carregar mais</Text>
            </TouchableOpacity>
          ) : null
        }
      />

      {/* FAB */}
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Criar novo post"
        style={{
          position: "absolute",
          bottom: 24,
          right: 20,
          width: 52,
          height: 52,
          borderRadius: 26,
          backgroundColor: "#CC0000",
          alignItems: "center",
          justifyContent: "center",
          shadowColor: "#CC0000",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.4,
          shadowRadius: 8,
          elevation: 6,
        }}
        onPress={() => setShowCreate(true)}
      >
        <Ionicons name="add" size={28} color="#FFFFFF" />
      </TouchableOpacity>

      <CreatePostModal
        visible={showCreate}
        onClose={() => setShowCreate(false)}
        onSubmit={async (text, imageUri) => {
          await createPost(text, imageUri);
          setShowCreate(false);
        }}
      />

      <CommentsModal
        visible={activePostId !== null}
        postId={activePostId}
        onClose={() => setActivePostId(null)}
        onCommentAdded={() => {}}
      />
    </View>
  );
}
