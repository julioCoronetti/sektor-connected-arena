# Plano 05 — Comunidade (Fórum)

> **Princípio central:** O fórum é a área "fora do jogo". Deve ser simples e funcional. `useCommunity` encapsula tudo — a tela só renderiza. Curtidas otimistas, sem bibliotecas extras.

---

## Objetivo

Implementar o fórum da Comunidade: feed de posts filtrado por time, criação de post com upload de mídia para S3, sistema de curtidas e comentários via API REST.

---

## Dependências

**Plano 01 concluído:**
- Rota `src/app/(tabs)/community.tsx` existe
- Tipos `Post` e `Comment` definidos em `src/types/index.ts`
- Arquivo `src/hooks/useCommunity.ts` existe (stub)
- Arquivo `src/services/api.ts` existe (stub)

**Plano 02 concluído:**
- `useAuthStore().user` disponível com `teamId` e token Cognito
- Token de autenticação acessível via `fetchAuthSession()` do Amplify para headers das requisições

---

## Princípios de Simplicidade

- `useCommunity` encapsula toda a lógica de fetch — a tela `community.tsx` apenas consome o hook
- Upload de mídia: URL pré-assinada S3 via Lambda → upload direto do cliente — sem proxy de mídia
- Paginação com cursor `lastKey` do DynamoDB — sem offset, sem bibliotecas externas
- Curtidas são **otimistas**: atualizar estado local imediatamente, reverter em caso de erro
- Posts são texto simples + uma imagem opcional — sem editor rich text
- Sem cache local persistente (AsyncStorage) neste plano — apenas estado em memória

---

## Protocolo da API REST

Todos os endpoints usam o token Cognito no header `Authorization: Bearer <token>`.

```
GET    /posts?teamId={teamId}&lastKey={cursor}   → { posts: Post[], lastKey?: string }
POST   /posts                                     → { post: Post }
POST   /posts/{postId}/like                       → { likes: number }
DELETE /posts/{postId}/like                       → { likes: number }
GET    /posts/{postId}/comments                   → { comments: Comment[] }
POST   /posts/{postId}/comments                   → { comment: Comment }
GET    /upload-url?filename={name}&type={mime}    → { uploadUrl: string, fileUrl: string }
```

---

## Arquivos a Implementar

### `src/services/api.ts`

```typescript
import { fetchAuthSession } from 'aws-amplify/auth';
import { API_REST_URL } from '../constants/config';

async function getAuthHeader(): Promise<Record<string, string>> {
  const session = await fetchAuthSession();
  const token = session.tokens?.idToken?.toString();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = await getAuthHeader();
  const response = await fetch(`${API_REST_URL}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...headers, ...options.headers },
  });
  if (!response.ok) throw new Error(`API error: ${response.status}`);
  return response.json();
}

export const api = {
  getPosts: (teamId: string, lastKey?: string) =>
    request<{ posts: any[]; lastKey?: string }>(`/posts?teamId=${teamId}${lastKey ? `&lastKey=${lastKey}` : ''}`),

  createPost: (text: string, imageUrl?: string) =>
    request<{ post: any }>('/posts', { method: 'POST', body: JSON.stringify({ text, imageUrl }) }),

  likePost: (postId: string) =>
    request<{ likes: number }>(`/posts/${postId}/like`, { method: 'POST' }),

  unlikePost: (postId: string) =>
    request<{ likes: number }>(`/posts/${postId}/like`, { method: 'DELETE' }),

  getComments: (postId: string) =>
    request<{ comments: any[] }>(`/posts/${postId}/comments`),

  createComment: (postId: string, text: string) =>
    request<{ comment: any }>(`/posts/${postId}/comments`, { method: 'POST', body: JSON.stringify({ text }) }),

  getUploadUrl: (filename: string, type: string) =>
    request<{ uploadUrl: string; fileUrl: string }>(`/upload-url?filename=${filename}&type=${type}`),
};
```

### `src/hooks/useCommunity.ts`

```typescript
import { useState, useCallback } from 'react';
import { api } from '../services/api';
import { useAuthStore } from '../store/authStore';
import type { Post, Comment } from '../types';

export function useCommunity() {
  const { user } = useAuthStore();
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [lastKey, setLastKey] = useState<string | undefined>();
  const [hasMore, setHasMore] = useState(true);

  const loadPosts = useCallback(async (reset = false) => {
    if (!user?.teamId) return;
    setIsLoading(true);
    try {
      const cursor = reset ? undefined : lastKey;
      const result = await api.getPosts(user.teamId, cursor);
      setPosts((prev) => reset ? result.posts : [...prev, ...result.posts]);
      setLastKey(result.lastKey);
      setHasMore(!!result.lastKey);
    } catch (e) {
      console.error('[Community] Erro ao carregar posts:', e);
    } finally {
      setIsLoading(false);
    }
  }, [user?.teamId, lastKey]);

  const createPost = useCallback(async (text: string, imageUri?: string) => {
    let imageUrl: string | undefined;

    if (imageUri) {
      const filename = `post-${Date.now()}.jpg`;
      const { uploadUrl, fileUrl } = await api.getUploadUrl(filename, 'image/jpeg');
      const blob = await fetch(imageUri).then((r) => r.blob());
      await fetch(uploadUrl, { method: 'PUT', body: blob, headers: { 'Content-Type': 'image/jpeg' } });
      imageUrl = fileUrl;
    }

    const { post } = await api.createPost(text, imageUrl);
    setPosts((prev) => [post, ...prev]);
  }, []);

  const toggleLike = useCallback(async (postId: string, isLiked: boolean) => {
    // Atualização otimista
    setPosts((prev) =>
      prev.map((p) => p.id === postId ? { ...p, likes: p.likes + (isLiked ? -1 : 1) } : p)
    );
    try {
      isLiked ? await api.unlikePost(postId) : await api.likePost(postId);
    } catch {
      // Reverter em caso de erro
      setPosts((prev) =>
        prev.map((p) => p.id === postId ? { ...p, likes: p.likes + (isLiked ? 1 : -1) } : p)
      );
    }
  }, []);

  return { posts, isLoading, hasMore, loadPosts, createPost, toggleLike };
}
```

### `src/components/community/PostCard.tsx`

```tsx
import { Image, Text, TouchableOpacity, View } from 'react-native';
import type { Post } from '../../types';

interface Props {
  post: Post;
  onLike: () => void;
  onComment: () => void;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

export function PostCard({ post, onLike, onComment }: Props) {
  return (
    <View className="bg-white border-b border-gray-100 px-4 py-4">
      <View className="flex-row items-center mb-3">
        <View className="w-9 h-9 rounded-full bg-gray-200 items-center justify-center mr-3">
          <Text className="font-bold text-gray-600">{post.authorName[0]?.toUpperCase()}</Text>
        </View>
        <View>
          <Text className="font-semibold text-sm">{post.authorName}</Text>
          <Text className="text-xs text-gray-400">{timeAgo(post.createdAt)}</Text>
        </View>
      </View>

      <Text className="text-base mb-3">{post.text}</Text>

      {post.imageUrl && (
        <Image source={{ uri: post.imageUrl }} className="w-full h-48 rounded-xl mb-3" resizeMode="cover" />
      )}

      <View className="flex-row gap-4">
        <TouchableOpacity onPress={onLike} className="flex-row items-center gap-1">
          <Text className="text-gray-500">❤️ {post.likes}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onComment} className="flex-row items-center gap-1">
          <Text className="text-gray-500">💬 {post.commentCount}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
```

### `src/app/(tabs)/community.tsx`

```tsx
import { useEffect, useState } from 'react';
import { FlatList, Text, TouchableOpacity, View } from 'react-native';
import { useCommunity } from '../../hooks/useCommunity';
import { PostCard } from '../../components/community/PostCard';
import { CreatePostModal } from '../../components/community/CreatePostModal';

export default function CommunityScreen() {
  const { posts, isLoading, hasMore, loadPosts, createPost, toggleLike } = useCommunity();
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => { loadPosts(true); }, []);

  return (
    <View className="flex-1 bg-gray-50">
      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <PostCard
            post={item}
            onLike={() => toggleLike(item.id, false)}
            onComment={() => {/* Plano 05 — comentários */}}
          />
        )}
        onRefresh={() => loadPosts(true)}
        refreshing={isLoading && posts.length === 0}
        ListFooterComponent={
          hasMore ? (
            <TouchableOpacity className="py-4 items-center" onPress={() => loadPosts()}>
              <Text className="text-blue-500">Carregar mais</Text>
            </TouchableOpacity>
          ) : null
        }
      />

      <TouchableOpacity
        className="absolute bottom-6 right-6 w-14 h-14 bg-black rounded-full items-center justify-center shadow-lg"
        onPress={() => setShowCreate(true)}
      >
        <Text className="text-white text-2xl">+</Text>
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
```

### `src/components/community/CreatePostModal.tsx`

Modal simples com campo de texto e botão de imagem:

```tsx
import { useState } from 'react';
import { Alert, Modal, Text, TextInput, TouchableOpacity, View } from 'react-native';
// Usar expo-image-picker para selecionar imagem

interface Props {
  visible: boolean;
  onClose: () => void;
  onSubmit: (text: string, imageUri?: string) => Promise<void>;
}

export function CreatePostModal({ visible, onClose, onSubmit }: Props) {
  const [text, setText] = useState('');
  const [imageUri, setImageUri] = useState<string | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!text.trim()) return;
    setIsSubmitting(true);
    try {
      await onSubmit(text.trim(), imageUri);
      setText('');
      setImageUri(undefined);
    } catch {
      Alert.alert('Erro', 'Não foi possível publicar. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View className="flex-1 p-6 bg-white">
        <View className="flex-row justify-between items-center mb-6">
          <TouchableOpacity onPress={onClose}><Text className="text-gray-500">Cancelar</Text></TouchableOpacity>
          <Text className="font-bold text-lg">Novo Post</Text>
          <TouchableOpacity onPress={handleSubmit} disabled={isSubmitting || !text.trim()}>
            <Text className={`font-bold ${text.trim() ? 'text-black' : 'text-gray-300'}`}>Publicar</Text>
          </TouchableOpacity>
        </View>
        <TextInput
          className="text-base flex-1"
          placeholder="O que está acontecendo?"
          value={text}
          onChangeText={setText}
          multiline
          autoFocus
        />
      </View>
    </Modal>
  );
}
```

---

## Pacotes Adicionais

```bash
npx expo install expo-image-picker
```

---

## Critérios de Aceitação (Checklist de Done)

- [ ] Feed de posts carrega filtrado pelo `teamId` do usuário autenticado
- [ ] Posts ordenados por data de criação decrescente
- [ ] Máximo 20 posts por página com botão "Carregar mais"
- [ ] "Carregar mais" usa cursor `lastKey` sem duplicar posts
- [ ] Modal de criação de post abre com campo de texto e opção de imagem
- [ ] Post com imagem: upload direto para S3 via URL pré-assinada
- [ ] Falha no upload exibe erro sem perder o texto digitado
- [ ] Curtida atualiza contador imediatamente (otimista)
- [ ] Falha na curtida reverte o contador e exibe notificação discreta
- [ ] Comentários exibidos ao acionar "Ver comentários"
- [ ] Novo comentário aparece imediatamente sem recarregar o feed
- [ ] Card de post exibe: avatar (inicial), nome, data relativa, texto, imagem, curtidas
- [ ] `tsc --noEmit` passa sem erros

---

## O que este plano entrega para os próximos

| Plano | O que usa deste plano |
|-------|----------------------|
| Plano 06 | Feed e cards de post prontos para receber o tema visual Sektor |
