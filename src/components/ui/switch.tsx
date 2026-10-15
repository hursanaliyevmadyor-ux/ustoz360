"use client";
import * as S from "@radix-ui/react-switch";
export const Switch = (p: S.SwitchProps) => (
  <S.Root className="h-6 w-11 shrink-0 rounded-full bg-border data-[state=checked]:bg-primary transition-colors" {...p}>
    <S.Thumb className="block h-5 w-5 translate-x-0.5 rounded-full bg-white shadow transition-transform data-[state=checked]:translate-x-[22px]" />
  </S.Root>
);
