import React from "react";
import type { Card as CardT, Suit } from "@gin-tv/shared";

const SUIT_GLYPH: Record<Suit, string> = { S: "♠", H: "♥", D: "♦", C: "♣" };
const SUIT_RED: Record<Suit, boolean> = { S: false, H: true, D: true, C: false };

export function Card({ card, small }: { card: CardT; small?: boolean }) {
  const red = SUIT_RED[card.suit];
  return (
    <div className={`card ${red ? "red" : "black"} ${small ? "small" : ""}`}>
      <div className="corner-top">
        <span>{card.rank}</span>
        <span className="pip">{SUIT_GLYPH[card.suit]}</span>
      </div>
      <div className="center-glyph">{SUIT_GLYPH[card.suit]}</div>
      <div className="corner-bot">
        <span>{card.rank}</span>
        <span className="pip">{SUIT_GLYPH[card.suit]}</span>
      </div>
    </div>
  );
}

export function CardBack({ small }: { small?: boolean }) {
  return <div className={`card back ${small ? "small" : ""}`} />;
}
