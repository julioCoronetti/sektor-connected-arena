import { Image, Text, TouchableOpacity, View } from "react-native";

import type { Post } from "../../types";

interface PostCardProps {
  post: Post;
  onLike: () => void;
  onComment: () => void;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "agora";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

export function PostCard({ post, onLike, onComment }: PostCardProps) {
  return (
    <View className="border-b border-gray-100 bg-white px-4 py-4">
      <View className="mb-3 flex-row items-center">
        <View className="mr-3 h-9 w-9 items-center justify-center rounded-full bg-gray-200">
          <Text className="font-bold text-gray-600">
            {post.authorName[0]?.toUpperCase() ?? "?"}
          </Text>
        </View>
        <View>
          <Text className="text-sm font-semibold">{post.authorName}</Text>
          <Text className="text-xs text-gray-400">
            {timeAgo(post.createdAt)}
          </Text>
        </View>
      </View>

      <Text className="mb-3 text-base">{post.text}</Text>

      {post.imageUrl ? (
        <Image
          source={{ uri: post.imageUrl }}
          className="mb-3 h-48 w-full rounded-xl"
          resizeMode="cover"
          accessibilityLabel="Imagem do post"
        />
      ) : null}

      <View className="flex-row gap-4">
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={`Curtir, ${post.likes} curtidas`}
          onPress={onLike}
          className="flex-row items-center gap-1"
        >
          <Text className="text-gray-500">❤️ {post.likes}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={`Comentários, ${post.commentCount} comentários`}
          onPress={onComment}
          className="flex-row items-center gap-1"
        >
          <Text className="text-gray-500">💬 {post.commentCount}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
