import * as ImagePicker from "expo-image-picker";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
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
  const [imageUri, setImageUri] = useState<string | undefined>(undefined);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canSubmit = text.trim().length > 0 && !isSubmitting;

  const handlePickImage = async () => {
    if (isSubmitting) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permission.status !== "granted") {
      Alert.alert(
        "Permissão necessária",
        "Habilite acesso à galeria para anexar uma foto. Você ainda pode publicar sem imagem.",
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsEditing: false,
    });
    if (!result.canceled && result.assets && result.assets.length > 0) {
      setImageUri(result.assets[0].uri);
    }
  };

  const handleRemoveImage = () => {
    if (isSubmitting) return;
    setImageUri(undefined);
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setIsSubmitting(true);
    try {
      await onSubmit(text.trim(), imageUri);
      setText("");
      setImageUri(undefined);
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
        <View className="mt-4 flex-row items-center">
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Anexar imagem"
            onPress={handlePickImage}
            disabled={isSubmitting}
            className="mr-3 h-10 w-10 items-center justify-center rounded-full bg-sektor-card"
          >
            <Text className="text-xl">📷</Text>
          </TouchableOpacity>
          {imageUri ? (
            <View className="relative">
              <Image
                source={{ uri: imageUri }}
                style={{ width: 80, height: 80, borderRadius: 8 }}
              />
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Remover imagem"
                onPress={handleRemoveImage}
                disabled={isSubmitting}
                className="absolute -right-2 -top-2 h-6 w-6 items-center justify-center rounded-full bg-black/70"
              >
                <Text className="text-xs font-bold text-white">X</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}
