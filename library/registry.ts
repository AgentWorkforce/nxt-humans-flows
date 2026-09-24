// The approved component set: the only components a generated email may use.
// Each entry names the Figma library component it stands for and the component
// properties designers fill in there. Adding a component means adding it here
// and in components.tsx; nothing else in the flow changes.

export type PropKind = "text" | "url" | "image" | "enum";

export interface PropDef {
  kind: PropKind;
  /** The component property name in the Figma library (without its `#id` suffix). */
  figma: string;
  required?: boolean;
  values?: readonly string[];
  description: string;
}

export interface ComponentDef {
  /** The Figma library component this renders, e.g. `Email/Hero`. */
  figma: string;
  description: string;
  props: Readonly<Record<string, PropDef>>;
}

export const REGISTRY = {
  Header: {
    figma: "Email/Header",
    description: "Top bar with the brand logo, optionally linked.",
    props: {
      logo: { kind: "image", figma: "Logo", required: true, description: "Logo image" },
      logoAlt: { kind: "text", figma: "Logo alt", required: true, description: "Alt text for the logo" },
      href: { kind: "url", figma: "Link", description: "Where the logo links to" },
    },
  },
  Hero: {
    figma: "Email/Hero",
    description: "Full-width image with a headline, optional body copy and optional call to action.",
    props: {
      image: { kind: "image", figma: "Image", required: true, description: "Hero image" },
      imageAlt: { kind: "text", figma: "Image alt", required: true, description: "Alt text for the hero image" },
      headline: { kind: "text", figma: "Headline", required: true, description: "Main headline" },
      body: { kind: "text", figma: "Body", description: "Supporting copy under the headline" },
      ctaLabel: { kind: "text", figma: "CTA label", description: "Button label; requires ctaUrl" },
      ctaUrl: { kind: "url", figma: "CTA URL", description: "Button destination; requires ctaLabel" },
    },
  },
  Heading: {
    figma: "Email/Heading",
    description: "A section heading.",
    props: {
      text: { kind: "text", figma: "Text", required: true, description: "Heading text" },
      level: { kind: "enum", figma: "Level", values: ["h1", "h2", "h3"], description: "Heading level, h2 when absent" },
    },
  },
  Text: {
    figma: "Email/Text",
    description: "A paragraph of body copy.",
    props: {
      text: { kind: "text", figma: "Text", required: true, description: "Paragraph text" },
      align: { kind: "enum", figma: "Align", values: ["left", "center"], description: "Alignment, left when absent" },
    },
  },
  Button: {
    figma: "Email/Button",
    description: "A standalone call-to-action button.",
    props: {
      label: { kind: "text", figma: "Label", required: true, description: "Button label" },
      href: { kind: "url", figma: "URL", required: true, description: "Button destination" },
      variant: { kind: "enum", figma: "Variant", values: ["primary", "secondary"], description: "Style, primary when absent" },
    },
  },
  Image: {
    figma: "Email/Image",
    description: "A content image, optionally linked.",
    props: {
      src: { kind: "image", figma: "Image", required: true, description: "The image" },
      alt: { kind: "text", figma: "Alt", required: true, description: "Alt text" },
      href: { kind: "url", figma: "Link", description: "Where the image links to" },
    },
  },
  Divider: {
    figma: "Email/Divider",
    description: "A horizontal rule between sections.",
    props: {},
  },
  Footer: {
    figma: "Email/Footer",
    description: "Legal footer: company name, postal address and the unsubscribe link (added automatically).",
    props: {
      company: { kind: "text", figma: "Company", required: true, description: "Legal company name" },
      address: { kind: "text", figma: "Address", required: true, description: "Postal address (required by CAN-SPAM)" },
    },
  },
} as const satisfies Record<string, ComponentDef>;

export type ComponentName = keyof typeof REGISTRY;
export const COMPONENT_NAMES = Object.keys(REGISTRY) as ComponentName[];

/** The Figma library component that carries the subject line and preheader; it is not rendered. */
export const META_COMPONENT = "Email/Meta";

export function componentForFigma(figmaName: string): ComponentName | undefined {
  return COMPONENT_NAMES.find((name) => REGISTRY[name].figma === figmaName);
}

export function propDefs(name: ComponentName): Readonly<Record<string, PropDef>> {
  return REGISTRY[name].props;
}
