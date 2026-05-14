import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

interface CreatePostModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (text: string, imageUri?: string) => Promise<void>;
}

export function CreatePostModal({
  visible,
  onClose,
  onSubmit,
}: CreatePostModalProps) {
  const [text, setText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canSubmit = text.trim().length > 0 && !isSubmitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setIsSubmitting(true);
    try {
      await onSubmit(text.trim(), undefined);
      setText("");
    } catch {
      Alert.alert("Erro", "Não foi possível publicar. Tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      onClose();
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View className="flex-1 bg-sektor-bg p-6">
        <View className="mb-6 flex-row items-center justify-between">
          <TouchableOpacity
            accessibilityRole="button"
            onPress={handleClose}
            disabled={isSubmitting}
          >
            <Text className="text-sektor-muted">Cancelar</Text>
          </TouchableOpacity>
          <Text className="text-lg font-bold text-sektor-text">Novo Post</Text>
          <TouchableOpacity
            accessibilityRole="button"
            onPress={handleSubmit}
            disabled={!canSubmit}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color="#6C63FF" />
            ) : (
              <Text
                className={`font-bold ${canSubmit ? "text-sektor-accent" : "text-sektor-muted"}`}
              >
                Publicar
              </Text>
            )}
          </TouchableOpacity>
        </View>
        <TextInput
          className="flex-1 text-base text-sektor-text"
          placeholder="O que está acontecendo?"
          placeholderTextColor="#6B6B80"
          value={text}
          onChangeText={setText}
          multiline
          autoFocus
          editable={!isSubmitting}
          textAlignVertical="top"
        />
      </View>
    </Modal>
  );
}
