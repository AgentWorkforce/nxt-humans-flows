// The approved React Email components, one per registry entry. Styling comes
// from the design library's tokens in theme.ts; nothing else sets a color or font.
import { Body, Button as EmailButton, Column, Container, Head, Heading as EmailHeading, Hr, Html, Img, Link, Preview, Row, Section, Text as EmailText } from "@react-email/components";
import type { ReactNode } from "react";
import type { EmailSpec } from "../lib/spec.ts";
import { theme } from "./theme.ts";

type Src = (file: string) => string;

const button = (variant: string | undefined) => ({
  backgroundColor: variant === "secondary" ? theme.color.surface : theme.color.brand,
  color: variant === "secondary" ? theme.color.brand : theme.color.onBrand,
  border: `2px solid ${theme.color.brand}`,
  borderRadius: theme.radius,
  fontWeight: 600,
  fontSize: 16,
  padding: "12px 24px",
  textDecoration: "none",
});

export function Header(p: { logo: string; logoAlt: string; href?: string; src: Src }) {
  const logo = <Img src={p.src(p.logo)} alt={p.logoAlt} height={32} style={{ display: "block" }} />;
  return <Section style={{ padding: "24px 32px" }}>{p.href ? <Link href={p.href}>{logo}</Link> : logo}</Section>;
}

export function Hero(p: { image: string; imageAlt: string; headline: string; body?: string; ctaLabel?: string; ctaUrl?: string; src: Src }) {
  return (
    <Section>
      <Img src={p.src(p.image)} alt={p.imageAlt} width={theme.width} style={{ display: "block", width: "100%", height: "auto" }} />
      <Section style={{ padding: "24px 32px 8px" }}>
        <EmailHeading as="h1" style={{ ...theme.type.h1, margin: 0 }}>{p.headline}</EmailHeading>
        {p.body && <EmailText style={theme.type.body}>{p.body}</EmailText>}
        {p.ctaLabel && p.ctaUrl && <EmailButton href={p.ctaUrl} style={button("primary")}>{p.ctaLabel}</EmailButton>}
      </Section>
    </Section>
  );
}

export function Heading(p: { text: string; level?: string }) {
  const as = (p.level ?? "h2") as "h1" | "h2" | "h3";
  return <Section style={{ padding: "16px 32px 0" }}><EmailHeading as={as} style={{ ...theme.type[as], margin: 0 }}>{p.text}</EmailHeading></Section>;
}

export function Text(p: { text: string; align?: string }) {
  return <Section style={{ padding: "0 32px" }}><EmailText style={{ ...theme.type.body, textAlign: p.align === "center" ? "center" : "left" }}>{p.text}</EmailText></Section>;
}

export function Button(p: { label: string; href: string; variant?: string }) {
  return <Section style={{ padding: "8px 32px 16px" }}><EmailButton href={p.href} style={button(p.variant)}>{p.label}</EmailButton></Section>;
}

export function Image(p: { src: string; alt: string; href?: string; resolve: Src }) {
  const img = <Img src={p.resolve(p.src)} alt={p.alt} width={theme.width - 64} style={{ display: "block", width: "100%", height: "auto" }} />;
  return <Section style={{ padding: "16px 32px" }}>{p.href ? <Link href={p.href}>{img}</Link> : img}</Section>;
}

export function Divider() {
  return <Section style={{ padding: "8px 32px" }}><Hr style={{ borderColor: theme.color.border, margin: 0 }} /></Section>;
}

export function Footer(p: { company: string; address: string; unsubscribeUrl: string }) {
  return (
    <Section style={{ padding: "24px 32px", backgroundColor: theme.color.muted }}>
      <Row>
        <Column>
          <EmailText style={{ ...theme.type.small, margin: 0 }}>{p.company} · {p.address}</EmailText>
          <EmailText style={{ ...theme.type.small, margin: "8px 0 0" }}>
            <Link href={p.unsubscribeUrl} style={{ color: theme.color.textMuted, textDecoration: "underline" }}>Unsubscribe</Link>
          </EmailText>
        </Column>
      </Row>
    </Section>
  );
}

/** The whole email: a spec rendered through the approved components only. */
export function Email({ spec, src, unsubscribeUrl }: { spec: EmailSpec; src: Src; unsubscribeUrl: string }) {
  const blocks: ReactNode[] = spec.blocks.map((b, i) => {
    const p = b.props as Record<string, string>;
    switch (b.component) {
      case "Header": return <Header key={i} logo={p.logo!} logoAlt={p.logoAlt!} href={p.href} src={src} />;
      case "Hero": return <Hero key={i} image={p.image!} imageAlt={p.imageAlt!} headline={p.headline!} body={p.body} ctaLabel={p.ctaLabel} ctaUrl={p.ctaUrl} src={src} />;
      case "Heading": return <Heading key={i} text={p.text!} level={p.level} />;
      case "Text": return <Text key={i} text={p.text!} align={p.align} />;
      case "Button": return <Button key={i} label={p.label!} href={p.href!} variant={p.variant} />;
      case "Image": return <Image key={i} src={p.src!} alt={p.alt!} href={p.href} resolve={src} />;
      case "Divider": return <Divider key={i} />;
      case "Footer": return <Footer key={i} company={p.company!} address={p.address!} unsubscribeUrl={unsubscribeUrl} />;
    }
  });
  return (
    <Html lang="en">
      <Head />
      {spec.preheader && <Preview>{spec.preheader}</Preview>}
      <Body style={{ backgroundColor: theme.color.canvas, fontFamily: theme.font, margin: 0, padding: "24px 0" }}>
        <Container style={{ width: theme.width, maxWidth: "100%", backgroundColor: theme.color.surface }}>{blocks}</Container>
      </Body>
    </Html>
  );
}
