import type { ReactNode } from "react";

export type OrganizerType =
  | "production_company"
  | "venue_owner"
  | "independent_host";

export type OrganizerTypeOption = {
  value: OrganizerType;
  icon: ReactNode;
  label: string;
  description: string;
};

// SVG icons in Revolut-style monoline, 18px stroke 1.6, currentColor.
const ProductionIcon = (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
    <path
      d="M10 2.5a3.5 3.5 0 100 7 3.5 3.5 0 000-7z"
      stroke="currentColor"
      strokeWidth="1.5"
    />
    <path
      d="M10 11.5c-3.6 0-6.5 1.8-6.5 4v1h13v-1c0-2.2-2.9-4-6.5-4z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
    />
    <path
      d="M14.5 4.5l1.2 1.2M16.5 7.5h1.2"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
);

const VenueIcon = (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
    <path
      d="M3 8.5L10 3l7 5.5V16a1 1 0 01-1 1h-3v-5H7v5H4a1 1 0 01-1-1V8.5z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
    />
  </svg>
);

const HostIcon = (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
    <path
      d="M10 2.5l1.7 3.5 3.8.5-2.8 2.7.7 3.8L10 11.2l-3.4 1.8.7-3.8L4.5 6.5l3.8-.5L10 2.5z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
    />
    <path
      d="M5.5 17h9"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
);

export const ORGANIZER_TYPE_OPTIONS: ReadonlyArray<OrganizerTypeOption> = [
  {
    value: "production_company",
    icon: ProductionIcon,
    label: "Productora / agencia",
    description:
      "Organizo eventos para varios clientes o locales. Manejo distintas marcas que no son mías.",
  },
  {
    value: "venue_owner",
    icon: VenueIcon,
    label: "Dueño de venue",
    description:
      "Tengo mi propio local y organizo los eventos que pasan ahí.",
  },
  {
    value: "independent_host",
    icon: HostIcon,
    label: "Anfitrión",
    description:
      "Armo mis propias fiestas cada tanto, sin productora ni local fijo.",
  },
];

export type OrganizerCopy = {
  legalEntityTerm: { title: string; inline: string; yours: string };
  newEntity: {
    headline: string;
    subhint: string;
    nameLabel: string;
    namePlaceholder: string;
  };
  newBrand: {
    headline: string;
    subhint: string;
    livesUnderLabel: string;
    fieldHint: string;
  };
  legalEntityEditor: {
    eyebrow: string;
    descriptionPrefix: string;
  };
};

export const copyFor = (type: OrganizerType | null): OrganizerCopy => {
  const t = type ?? "production_company";

  if (t === "venue_owner") {
    return {
      legalEntityTerm: { title: "Local", inline: "local", yours: "Tu local" },
      newEntity: {
        headline: "Tu local",
        subhint:
          "El venue donde organizas. Puedes tener varias marcas o conceptos bajo el mismo local (noches recurrentes, fiestas temáticas).",
        nameLabel: "Nombre del local",
        namePlaceholder: "Nombre del local",
      },
      newBrand: {
        headline: "Tu primera marca",
        subhint:
          "El concepto con el que tu público te conoce. Puedes crear más después.",
        livesUnderLabel: "Local",
        fieldHint:
          "Si tu local y tu marca son lo mismo, deja este nombre. Si tienes varias noches con identidad propia, ponle el nombre de la principal.",
      },
      legalEntityEditor: { eyebrow: "Local", descriptionPrefix: "Los cambios afectan a" },
    };
  }

  if (t === "independent_host") {
    return {
      legalEntityTerm: { title: "Productora", inline: "productora", yours: "Tu productora" },
      newEntity: {
        headline: "Tu productora",
        subhint:
          "Cómo le llamamos al paraguas de tus fiestas. Si solo armas eventos esporádicos, pon tu nombre o el de tu crew.",
        nameLabel: "Nombre",
        namePlaceholder: "Nombre de tu crew",
      },
      newBrand: {
        headline: "Tu primera marca",
        subhint:
          "Cómo se llama la fiesta o serie. Puedes crear más después.",
        livesUnderLabel: "Bajo",
        fieldHint:
          "Si solo armas una fiesta, ponle el nombre del evento. Si planeas varias series, ponle el nombre de la primera.",
      },
      legalEntityEditor: { eyebrow: "Tu productora", descriptionPrefix: "Los cambios afectan a" },
    };
  }

  return {
    legalEntityTerm: { title: "Cliente", inline: "cliente", yours: "Tu cliente" },
    newEntity: {
      headline: "Tu cliente",
      subhint:
        "El local o marca matriz para la que organizas. Bajo este cliente viven todas sus marcas o conceptos. Más adelante podrás agregar otros clientes.",
      nameLabel: "Nombre del cliente",
      namePlaceholder: "Nombre del cliente",
    },
    newBrand: {
      headline: "Primera marca del cliente",
      subhint:
        "El nombre con el que el público lo conoce. Puedes agregar más marcas después.",
      livesUnderLabel: "Cliente",
      fieldHint:
        "Si el cliente solo tiene una marca, deja este nombre igual. Si tiene varias marcas o conceptos, ponle el nombre del principal.",
    },
    legalEntityEditor: { eyebrow: "Cliente", descriptionPrefix: "Los cambios afectan a" },
  };
};
