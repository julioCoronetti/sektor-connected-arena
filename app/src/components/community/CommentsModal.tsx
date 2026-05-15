import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { useCommunity } from "../../hooks/useCommunity";
import type { Comment } from "../../types";
import { timeAgo } from "./PostCard";

interface CommentsModalProps {
  visible: boolean;
  postId: string | null;
  onClose: () => void;
  onCommentAdded: (postId: string) => void;
}

function CommentsModal({
  visible,
  postId,
  onClose,
  onCommentAdded,
}: CommentsModalProps) {
  const { getComments, addComment } = useCommunity();

  const [comments, setComments] = useState<Comment[]>([]);
  const [text, setText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!visible || !postId) {
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setErrorMessage(null);
    setComments([]);

    getComments(postId)
      .then((result) => {
        if (!cancelled) {
          setComments(result);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setErrorMessage("Não foi possível carregar os comentários.");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [postId, visible, getComments]);

  const canSubmit = text.trim().length > 0 && !isSubmitting && !!postId;

  const handleSubmit = async () => {
    if (!canSubmit || !postId) return;
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const comment = await addComment(postId, text.trim());
      setComments((prev) => [...prev, comment]);
      setText("");
      onCommentAdded(postId);
    } catch {
      setErrorMessage("Não foi possível enviar o comentário. Tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (isSubmitting) return;
    setText("");
    setComments([]);
    setErrorMessage(null);
    onClose();
  };

  const renderItem = ({ item }: { item: Comment }) => (
    <View className="border-b border-sektor-border px-4 py-3">
      <View className="mb-1 flex-row items-center justify-between">
        <Text className="text-sm font-semibold text-sektor-text">
          {item.authorName}
        </Text>
        <Text className="text-xs text-sektor-muted">
          {timeAgo(item.createdAt)}
        </Text>
      </View>
      <Text className="text-sm text-sektor-text">{item.text}</Text>
    </View>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1 bg-sektor-bg"
      >
        <View className="flex-row items-center justify-between border-b border-sektor-border px-4 py-4">
          <Text className="text-lg font-bold text-sektor-text">
            Comentários
          </Text>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Fechar comentários"
            onPress={handleClose}
            disabled={isSubmitting}
          >
            <Text className="text-lg text-sektor-muted">✕</Text>
          </TouchableOpacity>
        </View>

        {isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="small" color="#6C63FF" />
          </View>
        ) : (
          <FlatList
            data={comments}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            contentContainerStyle={
              comments.length === 0
                ? { flexGrow: 1, justifyContent: "center" }
                : undefined
            }
            ListEmptyComponent={
              !errorMessage ? (
                <View className="items-center justify-center px-4">
                  <Text className="text-sektor-muted">
                    Seja o primeiro a comentar.
                  </Text>
                </View>
              ) : null
            }
          />
        )}

        <View className="border-t border-sektor-border px-4 py-3">
          {errorMessage ? (
            <Text className="mb-2 text-xs text-red-400">{errorMessage}</Text>
          ) : null}
          <View className="flex-row items-center gap-2">
            <TextInput
              className="flex-1 rounded-full bg-sektor-surface px-4 py-2 text-sektor-text"
              placeholder="Escreva um comentário..."
              placeholderTextColor="#6B6B80"
              value={text}
              onChangeText={setText}
              editable={!isSubmitting}
              multiline
            />
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Enviar comentário"
              onPress={handleSubmit}
              disabled={!canSubmit}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#6C63FF" />
              ) : (
                <Text
                  className={`font-bold ${
                    canSubmit ? "text-sektor-accent" : "text-sektor-muted"
                  }`}
                >
                  Enviar
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export default CommentsModal;
