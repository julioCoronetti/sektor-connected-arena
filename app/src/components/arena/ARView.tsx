import { CameraView, useCameraPermissions } from "expo-camera";
import { Text, TouchableOpacity, View } from "react-native";

import type { Match, PositionsFrame, PressureBarState } from "../../types";

// Dimensões reais do campo em metros (conforme MatchInformations_Anonym.xml)
const PITCH_X = 105;
const PITCH_Y = 68;

interface ARViewProps {
  match: Match;
  pressureBar: PressureBarState;
  positionsFrame: PositionsFrame | null;
  onClose: () => void;
}

/**
 * Modo AR: câmera traseira com overlay de dados em tempo real.
 *
 * Quando há dados de tracking (positionsFrame), renderiza:
 *  - Mini-mapa do campo com posições reais dos jogadores
 *  - Bola (se disponível)
 *  - Barra de posse no topo
 *
 * Coordenadas do tracking: X ∈ [-52.5, 52.5], Y ∈ [-34, 34]
 * Mapeamos para o espaço do mini-mapa normalizado [0, 1].
 */
export function ARView({ match, pressureBar, positionsFrame, onClose }: ARViewProps) {
  const [permission, requestPermission] = useCameraPermissions();

  if (!permission?.granted) {
    return (
      <View className="flex-1 items-center justify-center bg-sektor-bg">
        <Text className="mb-4 px-8 text-center text-sektor-text">
          Permissão de câmera necessária para o Modo AR
        </Text>
        <TouchableOpacity
          accessibilityRole="button"
          className="rounded-xl bg-sektor-accent px-6 py-3"
          onPress={requestPermission}
        >
          <Text className="font-bold text-white">Permitir câmera</Text>
        </TouchableOpacity>
        <TouchableOpacity
          accessibilityRole="button"
          className="mt-4"
          onPress={onClose}
        >
          <Text className="text-sektor-muted">Voltar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const safeA = Math.max(0, pressureBar.teamA);
  const safeB = Math.max(0, pressureBar.teamB);
  const total = safeA + safeB;
  const widthA = total > 0 ? (safeA / total) * 100 : 50;

  return (
    <View className="flex-1">
      <CameraView className="flex-1" facing="back">
        <View className="absolute inset-0">
          {/* ── Barra de posse no topo ── */}
          <View className="absolute left-4 right-4 top-16">
            <View className="h-4 flex-row overflow-hidden rounded-full opacity-90">
              <View
                style={{ flex: widthA, backgroundColor: match.teamA.color }}
              />
              <View
                style={{ flex: 100 - widthA, backgroundColor: match.teamB.color }}
              />
            </View>
            <View className="mt-1 flex-row justify-between">
              <Text className="text-xs font-bold text-white">
                {match.teamA.name} {Math.round(widthA)}%
              </Text>
              <Text className="text-xs font-bold text-white">
                {Math.round(100 - widthA)}% {match.teamB.name}
              </Text>
            </View>
          </View>

          {/* ── Placar ── */}
          {match.score != null ? (
            <View className="absolute left-0 right-0 top-36 items-center">
              <View className="rounded-xl bg-black/70 px-6 py-2">
                <Text className="text-2xl font-bold text-white">
                  {match.score.home} – {match.score.guest}
                </Text>
                <Text className="text-center text-xs text-gray-300">
                  {match.minute}&apos;
                  {match.gameSection === "secondHalf" ? " (2T)" : " (1T)"}
                </Text>
              </View>
            </View>
          ) : null}

          {/* ── Mini-mapa de tracking ── */}
          {positionsFrame != null ? (
            <PitchMiniMap
              frame={positionsFrame}
              match={match}
            />
          ) : (
            /* Escudos fallback quando não há tracking */
            <>
              <View
                className="absolute bottom-24 left-4 h-16 w-16 items-center justify-center rounded-full opacity-80"
                style={{ backgroundColor: match.teamA.color }}
              >
                <Text className="text-lg font-bold text-white">
                  {match.teamA.name[0]}
                </Text>
              </View>
              <View
                className="absolute bottom-24 right-4 h-16 w-16 items-center justify-center rounded-full opacity-80"
                style={{ backgroundColor: match.teamB.color }}
              >
                <Text className="text-lg font-bold text-white">
                  {match.teamB.name[0]}
                </Text>
              </View>
            </>
          )}

          {/* ── Botão fechar ── */}
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Fechar modo AR"
            className="absolute right-4 top-16 h-10 w-10 items-center justify-center rounded-full bg-black/50"
            onPress={onClose}
          >
            <Text className="text-white">✕</Text>
          </TouchableOpacity>
        </View>
      </CameraView>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Mini-mapa do campo com posições reais
// ---------------------------------------------------------------------------

/** Largura do mini-mapa em pixels (layout fixo). */
const MAP_W = 220;
/** Altura do mini-mapa em pixels (mantém proporção 105:68). */
const MAP_H = Math.round((MAP_W * PITCH_Y) / PITCH_X);

/** Raio do ponto de cada jogador em pixels. */
const PLAYER_DOT = 5;
/** Raio do ponto da bola em pixels. */
const BALL_DOT = 4;

interface PitchMiniMapProps {
  frame: PositionsFrame;
  match: Match;
}

/**
 * Renderiza um mini-mapa 2D do campo com os jogadores e a bola.
 * Usa View/absolute positioning — sem SVG ou canvas para manter compatibilidade RN.
 *
 * Conversão de coordenadas:
 *   trackingX ∈ [-52.5, 52.5]  →  pixelX = (trackingX + 52.5) / 105 * MAP_W
 *   trackingY ∈ [-34, 34]      →  pixelY = (trackingY + 34)   / 68  * MAP_H
 */
function PitchMiniMap({ frame, match }: PitchMiniMapProps) {
  function toPixel(tx: number, ty: number): { px: number; py: number } {
    const px = ((tx + PITCH_X / 2) / PITCH_X) * MAP_W;
    const py = ((ty + PITCH_Y / 2) / PITCH_Y) * MAP_H;
    return { px, py };
  }

  return (
    <View
      className="absolute bottom-8 self-center overflow-hidden rounded-lg border border-white/30 bg-green-900/80"
      style={{ width: MAP_W, height: MAP_H }}
      accessibilityLabel="Mini-mapa de posições dos jogadores"
    >
      {/* Linhas do campo */}
      <PitchLines mapW={MAP_W} mapH={MAP_H} />

      {/* Jogadores */}
      {frame.players.map((p) => {
        const { px, py } = toPixel(p.x, p.y);
        const isTeamA = p.teamId === match.teamA.id;
        const color = isTeamA ? match.teamA.color : match.teamB.color;
        const left = px - PLAYER_DOT;
        const top = py - PLAYER_DOT;

        return (
          <View
            key={p.personId}
            style={{
              position: "absolute",
              left,
              top,
              width: PLAYER_DOT * 2,
              height: PLAYER_DOT * 2,
              borderRadius: PLAYER_DOT,
              backgroundColor: color,
              borderWidth: 1,
              borderColor: "white",
            }}
          />
        );
      })}

      {/* Bola */}
      {frame.ball != null ? (() => {
        const { px, py } = toPixel(frame.ball.x, frame.ball.y);
        return (
          <View
            style={{
              position: "absolute",
              left: px - BALL_DOT,
              top: py - BALL_DOT,
              width: BALL_DOT * 2,
              height: BALL_DOT * 2,
              borderRadius: BALL_DOT,
              backgroundColor: "white",
              borderWidth: 1,
              borderColor: "#333",
            }}
          />
        );
      })() : null}

      {/* Legenda */}
      <View className="absolute bottom-1 left-1 flex-row items-center gap-1">
        <View
          style={{
            width: 6,
            height: 6,
            borderRadius: 3,
            backgroundColor: match.teamA.color,
          }}
        />
        <Text style={{ color: "white", fontSize: 7 }}>{match.teamA.name}</Text>
      </View>
      <View className="absolute bottom-1 right-1 flex-row items-center gap-1">
        <Text style={{ color: "white", fontSize: 7 }}>{match.teamB.name}</Text>
        <View
          style={{
            width: 6,
            height: 6,
            borderRadius: 3,
            backgroundColor: match.teamB.color,
          }}
        />
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Linhas do campo (View-based, sem SVG)
// ---------------------------------------------------------------------------

interface PitchLinesProps {
  mapW: number;
  mapH: number;
}

/**
 * Desenha as linhas principais do campo usando Views absolutas:
 * - Linha do meio-campo (vertical)
 * - Círculo central (aproximado com border-radius)
 * - Áreas (grandes e pequenas) de cada lado
 */
function PitchLines({ mapW, mapH }: PitchLinesProps) {
  const midX = mapW / 2;
  const midY = mapH / 2;

  // Proporções reais: área grande = 40.32m x 16.5m, área pequena = 18.32m x 5.5m
  const bigBoxW = (40.32 / PITCH_Y) * mapH;
  const bigBoxH = (16.5 / PITCH_X) * mapW;
  const smallBoxW = (18.32 / PITCH_Y) * mapH;
  const smallBoxH = (5.5 / PITCH_X) * mapW;
  const centerCircleR = (9.15 / PITCH_X) * mapW;

  const lineStyle = {
    position: "absolute" as const,
    backgroundColor: "rgba(255,255,255,0.35)",
  };

  return (
    <>
      {/* Linha do meio-campo */}
      <View
        style={{
          ...lineStyle,
          left: midX - 0.5,
          top: 0,
          width: 1,
          height: mapH,
        }}
      />

      {/* Círculo central */}
      <View
        style={{
          position: "absolute",
          left: midX - centerCircleR,
          top: midY - centerCircleR,
          width: centerCircleR * 2,
          height: centerCircleR * 2,
          borderRadius: centerCircleR,
          borderWidth: 1,
          borderColor: "rgba(255,255,255,0.35)",
          backgroundColor: "transparent",
        }}
      />

      {/* Ponto central */}
      <View
        style={{
          ...lineStyle,
          left: midX - 1.5,
          top: midY - 1.5,
          width: 3,
          height: 3,
          borderRadius: 1.5,
        }}
      />

      {/* Área grande — lado esquerdo */}
      <View
        style={{
          position: "absolute",
          left: 0,
          top: midY - bigBoxW / 2,
          width: bigBoxH,
          height: bigBoxW,
          borderWidth: 1,
          borderColor: "rgba(255,255,255,0.35)",
          borderLeftWidth: 0,
          backgroundColor: "transparent",
        }}
      />

      {/* Área pequena — lado esquerdo */}
      <View
        style={{
          position: "absolute",
          left: 0,
          top: midY - smallBoxW / 2,
          width: smallBoxH,
          height: smallBoxW,
          borderWidth: 1,
          borderColor: "rgba(255,255,255,0.25)",
          borderLeftWidth: 0,
          backgroundColor: "transparent",
        }}
      />

      {/* Área grande — lado direito */}
      <View
        style={{
          position: "absolute",
          right: 0,
          top: midY - bigBoxW / 2,
          width: bigBoxH,
          height: bigBoxW,
          borderWidth: 1,
          borderColor: "rgba(255,255,255,0.35)",
          borderRightWidth: 0,
          backgroundColor: "transparent",
        }}
      />

      {/* Área pequena — lado direito */}
      <View
        style={{
          position: "absolute",
          right: 0,
          top: midY - smallBoxW / 2,
          width: smallBoxH,
          height: smallBoxW,
          borderWidth: 1,
          borderColor: "rgba(255,255,255,0.25)",
          borderRightWidth: 0,
          backgroundColor: "transparent",
        }}
      />
    </>
  );
}
