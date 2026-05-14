import { useEffect, useState } from "react";
import { FlatList, Text, TouchableOpacity, View } from "react-native";

import { CreatePostModal } from "../../components/community/CreatePostModal";
import { PostCard } from "../../components/community/PostCard";
import { useCommunity } from "../../hooks/useCommunity";

export default function CommunityScreen() {
  const { posts, isLoading, hasMore, error, loadPosts, createPost, toggleLike } =
    useCommunity();
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    loadPosts(true);
  }, [loadPosts]);

  return (
    <View className="flex-1 bg-sektor-bg">
      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <PostCard
            post={item}
            onLike={() => toggleLike(item.id, false)}
            onComment={() => {}}
          />
        )}
        onRefresh={() => loadPosts(true)}
        refreshing={isLoading && posts.length === 0}
        ListEmptyComponent={
          !isLoading ? (
            <View className="items-center py-12">
              <Text className="text-sektor-muted">
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
              <Text className="text-sektor-accent">Carregar mais</Text>
            </TouchableOpacity>
          ) : null
        }
      />

      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Criar novo post"
        className="absolute bottom-6 right-6 h-14 w-14 items-center justify-center rounded-full bg-sektor-accent shadow-lg"
        onPress={() => setShowCreate(true)}
      >
        <Text className="text-2xl text-white">+</Text>
      </TouchableOpacity>

      <CreatePostModal
        visible={showCreate}
        onClose={() => setShowCreate(false)}
        onSubmit={async (text, imageUri) => {
          await createPost(text, imageUri);
          setShowCreate(false);
        }}
      />
    </View>
  );
}
