import React, { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import { PenLine } from "lucide-react";

import type { Agent, AgentMeta, ClockParts } from "./OrbitSystem";
import skyImg from "../assets/sky.png";

type Props = {
  bodyRef: RefObject<HTMLDivElement>;
  agents: Agent[];
  speedMult: number;
  bgTextureUrl: string;
  clockParts: ClockParts;
  currentLabLabel: string;
  defaultPrompt: string;
  hoverPrompt: string;
  agentPrompt: string | null;
  onSelectAgentKey: (metaKey: string) => void;
  onStartTalk: (agent: AgentMeta) => void;
  onOpenFlow?: () => void;
  variantIndex?: number;
};

export default function BodyVariant3(_props: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  const [imgUrl, setImgUrl] = useState<string>(skyImg);
  const prevObjectUrlRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (prevObjectUrlRef.current) URL.revokeObjectURL(prevObjectUrlRef.current);
    };
  }, []);

  const openPicker = () => inputRef.current?.click();

  const onPickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Limpia URL anterior (si venía de upload)
    if (prevObjectUrlRef.current) {
      URL.revokeObjectURL(prevObjectUrlRef.current);
      prevObjectUrlRef.current = null;
    }

    const url = URL.createObjectURL(file);
    prevObjectUrlRef.current = url;
    setImgUrl(url);

    // permite volver a seleccionar el mismo archivo
    e.target.value = "";
  };

  return (
    <div className="bv3_root" aria-label="Body variant 3">
      <div className="bv3_center">
        <div className="bv3_frame">
          <img className="bv3_img" src={imgUrl} alt="Background" />

          <button
            type="button"
            className="bv3_editBtn"
            onClick={openPicker}
            aria-label="Edit image"
            title="Edit image"
          >
            <PenLine size={16} />
          </button>

          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            onChange={onPickFile}
            style={{ display: "none" }}
          />
        </div>
      </div>
    </div>
  );
}
