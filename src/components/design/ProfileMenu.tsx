"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { LogOut, UserRound } from "lucide-react";
import { Link, useRouter } from "@/i18n/navigation";
import { useSignOut } from "@/lib/identity/hooks/useFirebaseAuth";
import { Avatar } from "./Avatar";
import { C, FONT_DISPLAY } from "./tokens";

type Props = {
  initials?: string;
  color?: string;
};

export const ProfileMenu = ({ initials = "·", color = C.purple }: Props) => {
  const router = useRouter();
  const signOut = useSignOut();

  const handleSignOut = async () => {
    await signOut();
    router.replace("/");
  };

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          aria-label="Abrir menú de perfil"
          style={{
            width: 38,
            height: 38,
            border: 0,
            borderRadius: 14,
            padding: 0,
            background: "transparent",
            color: "#fff",
            cursor: "pointer",
          }}
        >
          <Avatar initials={initials} color={color} />
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={10}
          style={{
            minWidth: 178,
            padding: 6,
            borderRadius: 18,
            background: "rgba(18,18,26,0.96)",
            border: `1px solid ${C.line2}`,
            boxShadow: "0 22px 55px -24px rgba(0,0,0,0.8)",
            backdropFilter: "blur(18px)",
            zIndex: 80,
          }}
        >
          <DropdownMenu.Item asChild>
            <Link
              href="/profile"
              style={{
                height: 42,
                padding: "0 11px",
                borderRadius: 13,
                display: "flex",
                alignItems: "center",
                gap: 10,
                color: "#fff",
                textDecoration: "none",
                fontFamily: FONT_DISPLAY,
                fontSize: 13,
                fontWeight: 650,
                outline: "none",
              }}
            >
              <UserRound size={16} strokeWidth={2} color={C.purple} />
              Ver perfil
            </Link>
          </DropdownMenu.Item>

          <DropdownMenu.Separator
            style={{ height: 1, background: C.line, margin: "4px 6px" }}
          />

          <DropdownMenu.Item asChild>
            <button
              type="button"
              onClick={() => void handleSignOut()}
              style={{
                width: "100%",
                height: 42,
                padding: "0 11px",
                border: 0,
                borderRadius: 13,
                display: "flex",
                alignItems: "center",
                gap: 10,
                background: "transparent",
                color: C.red,
                fontFamily: FONT_DISPLAY,
                fontSize: 13,
                fontWeight: 650,
                textAlign: "left",
                cursor: "pointer",
                outline: "none",
              }}
            >
              <LogOut size={16} strokeWidth={2} color={C.red} />
              Cerrar sesión
            </button>
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
};
