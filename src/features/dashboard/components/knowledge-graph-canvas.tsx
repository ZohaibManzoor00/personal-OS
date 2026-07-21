"use client";

import {
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from "d3-force";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { resolveSectionBasePath } from "@/features/knowledge/lib/sections";
import { getSectionColor } from "../lib/section-meta";
import type { DashboardGraph } from "../types";

type SimNode = SimulationNodeDatum & {
  id: string;
  title: string;
  section: string;
  kind: "SECTION" | "SPACE" | "PAGE";
  radius: number;
  color: string;
};

type SimLink = SimulationLinkDatum<SimNode>;

type Transform = { k: number; x: number; y: number };

type Colors = {
  link: string;
  label: string;
  fg: string;
  bg: string;
  font: string;
};

const TAU = Math.PI * 2;
const MIN_ZOOM = 0.15;
const MAX_ZOOM = 4;
const CLICK_SLOP = 4;

/** Node draw radius by kind, nudged up a little by how connected it is. */
const radiusFor = (kind: SimNode["kind"], degree: number) => {
  if (kind === "SECTION") return 13 + Math.min(degree, 10) * 0.5;
  if (kind === "SPACE") return 6 + Math.min(degree, 10) * 0.7;
  return 4.5;
};

/** Resolve a CSS custom property to a concrete rgb() string via a probe node. */
const resolveVar = (el: HTMLElement, name: string) => {
  const probe = document.createElement("span");
  probe.style.cssText = `position:absolute;visibility:hidden;pointer-events:none;color:var(${name})`;
  el.appendChild(probe);
  const color = getComputedStyle(probe).color;
  probe.remove();
  return color || "rgb(120,120,120)";
};

export function KnowledgeGraphCanvas({ data }: { data: DashboardGraph }) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // --- Mutable engine state (kept in closures, not React state) --------------
    const size = { w: 1, h: 1 };
    const transform: Transform = { k: 1, x: 0, y: 0 };
    const colors: Colors = {
      link: "rgb(120,120,120)",
      label: "rgb(120,120,120)",
      fg: "rgb(20,20,20)",
      bg: "rgb(255,255,255)",
      font: "system-ui, sans-serif",
    };
    let hoveredId: string | null = null;
    let needsDraw = true;

    // --- Build graph model -----------------------------------------------------
    const degree = new Map<string, number>();
    for (const link of data.links) {
      degree.set(link.source, (degree.get(link.source) ?? 0) + 1);
      degree.set(link.target, (degree.get(link.target) ?? 0) + 1);
    }

    const nodes: SimNode[] = data.nodes.map((node) => ({
      id: node.id,
      title: node.title,
      section: node.section,
      kind: node.kind,
      radius: radiusFor(node.kind, degree.get(node.id) ?? 0),
      color: getSectionColor(node.section),
    }));

    const links: SimLink[] = data.links.map((link) => ({
      source: link.source,
      target: link.target,
    }));

    const adjacency = new Map<string, Set<string>>();
    for (const link of data.links) {
      (
        adjacency.get(link.source) ??
        adjacency.set(link.source, new Set()).get(link.source)
      )?.add(link.target);
      (
        adjacency.get(link.target) ??
        adjacency.set(link.target, new Set()).get(link.target)
      )?.add(link.source);
    }

    // Fixed per-section anchors around the origin so each section settles into
    // its own cluster regardless of canvas size (we only fit via the transform).
    const hubs = nodes.filter((node) => node.kind === "SECTION");
    const anchorRadius = 120 + Math.sqrt(nodes.length) * 16;
    const anchorBySection = new Map<string, { x: number; y: number }>();
    hubs.forEach((hub, i) => {
      if (hubs.length === 1) {
        anchorBySection.set(hub.section, { x: 0, y: 0 });
        return;
      }
      const angle = -Math.PI / 2 + (i / hubs.length) * TAU;
      anchorBySection.set(hub.section, {
        x: Math.cos(angle) * anchorRadius,
        y: Math.sin(angle) * anchorRadius,
      });
    });
    const anchorOf = (node: SimNode) =>
      anchorBySection.get(node.section) ?? { x: 0, y: 0 };

    // Seed each node near its section anchor for a stable, quick settle.
    for (const node of nodes) {
      const anchor = anchorOf(node);
      node.x = anchor.x + (Math.random() - 0.5) * 80;
      node.y = anchor.y + (Math.random() - 0.5) * 80;
    }

    const simulation = forceSimulation(nodes)
      .force(
        "link",
        forceLink<SimNode, SimLink>(links)
          .id((node) => node.id)
          .distance((link) => {
            const source = link.source as SimNode;
            const target = link.target as SimNode;
            if (source.kind === "SECTION") return 58;
            return target.kind === "PAGE" ? 24 : 34;
          })
          .strength((link) =>
            (link.source as SimNode).kind === "SECTION" ? 0.12 : 0.55,
          ),
      )
      .force("charge", forceManyBody<SimNode>().strength(-90).distanceMax(340))
      .force(
        "collide",
        forceCollide<SimNode>()
          .radius((node) => node.radius + 3)
          .iterations(2),
      )
      .force(
        "x",
        forceX<SimNode>((node) => anchorOf(node).x).strength((node) =>
          node.kind === "SECTION" ? 0.4 : 0.07,
        ),
      )
      .force(
        "y",
        forceY<SimNode>((node) => anchorOf(node).y).strength((node) =>
          node.kind === "SECTION" ? 0.4 : 0.07,
        ),
      )
      .stop();

    // --- Sizing / colors / fit -------------------------------------------------
    const applySize = () => {
      const rect = container.getBoundingClientRect();
      const w = Math.max(1, rect.width);
      const h = Math.max(1, rect.height);
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      size.w = w;
      size.h = h;
    };

    const readColors = () => {
      colors.link = resolveVar(container, "--muted-foreground");
      colors.label = resolveVar(container, "--muted-foreground");
      colors.fg = resolveVar(container, "--foreground");
      colors.bg = resolveVar(container, "--card");
      colors.font =
        getComputedStyle(container).fontFamily || "system-ui, sans-serif";
      needsDraw = true;
    };

    const fit = () => {
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (const node of nodes) {
        if (node.x == null || node.y == null) continue;
        minX = Math.min(minX, node.x - node.radius);
        minY = Math.min(minY, node.y - node.radius);
        maxX = Math.max(maxX, node.x + node.radius);
        maxY = Math.max(maxY, node.y + node.radius);
      }
      if (!Number.isFinite(minX)) return;
      const pad = 44;
      const spanX = Math.max(maxX - minX, 1);
      const spanY = Math.max(maxY - minY, 1);
      const k = Math.min(
        (size.w - pad * 2) / spanX,
        (size.h - pad * 2) / spanY,
      );
      const clamped = Math.max(MIN_ZOOM, Math.min(k, 2.2));
      const cx = (minX + maxX) / 2;
      const cy = (minY + maxY) / 2;
      transform.k = clamped;
      transform.x = size.w / 2 - cx * clamped;
      transform.y = size.h / 2 - cy * clamped;
      needsDraw = true;
    };

    applySize();
    readColors();
    for (let i = 0; i < 170; i++) simulation.tick();
    fit();

    // --- Drawing ---------------------------------------------------------------
    const draw = () => {
      const dpr = window.devicePixelRatio || 1;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, size.w, size.h);
      ctx.translate(transform.x, transform.y);
      ctx.scale(transform.k, transform.k);

      const neighbors = hoveredId ? adjacency.get(hoveredId) : null;

      ctx.lineCap = "round";
      for (const link of links) {
        const source = link.source as SimNode;
        const target = link.target as SimNode;
        if (source.x == null || target.x == null) continue;
        const active =
          hoveredId != null &&
          (source.id === hoveredId || target.id === hoveredId);
        ctx.beginPath();
        ctx.moveTo(source.x, source.y as number);
        ctx.lineTo(target.x, target.y as number);
        ctx.lineWidth = (active ? 1.6 : 1) / transform.k;
        ctx.strokeStyle = active ? target.color : colors.link;
        ctx.globalAlpha = hoveredId ? (active ? 0.85 : 0.05) : 0.16;
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      for (const node of nodes) {
        if (node.x == null || node.y == null) continue;
        const isHub = node.kind === "SECTION";
        const highlighted =
          !hoveredId || node.id === hoveredId || neighbors?.has(node.id);
        ctx.globalAlpha = highlighted ? 1 : 0.22;

        if (node.id === hoveredId || isHub) {
          ctx.shadowBlur = node.id === hoveredId ? 24 : 12;
          ctx.shadowColor = node.color;
        } else {
          ctx.shadowBlur = 0;
        }

        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius, 0, TAU);
        ctx.fillStyle = node.color;
        ctx.fill();
        ctx.shadowBlur = 0;

        ctx.lineWidth = (isHub ? 2 : 1.5) / transform.k;
        ctx.strokeStyle = colors.bg;
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      for (const node of nodes) {
        if (node.x == null || node.y == null) continue;
        const isHub = node.kind === "SECTION";
        const show =
          isHub ||
          node.id === hoveredId ||
          (hoveredId != null && neighbors?.has(node.id));
        if (!show) continue;

        const fontPx = (isHub ? 13 : 12) / transform.k;
        ctx.font = `${isHub ? 600 : 500} ${fontPx}px ${colors.font}`;
        const label =
          node.title.length > 28 ? `${node.title.slice(0, 27)}…` : node.title;
        const labelY = node.y + node.radius + 5 / transform.k;

        ctx.lineJoin = "round";
        ctx.lineWidth = 3 / transform.k;
        ctx.strokeStyle = colors.bg;
        ctx.strokeText(label, node.x, labelY);
        ctx.fillStyle = isHub ? colors.fg : colors.label;
        ctx.fillText(label, node.x, labelY);
      }
    };

    let raf = 0;
    const loop = () => {
      if (needsDraw) {
        draw();
        needsDraw = false;
      }
      raf = requestAnimationFrame(loop);
    };
    simulation.on("tick", () => {
      needsDraw = true;
    });
    raf = requestAnimationFrame(loop);
    simulation.alpha(0.6).alphaDecay(0.028).restart();

    // --- Interaction -----------------------------------------------------------
    const pointerPos = (event: PointerEvent | WheelEvent) => {
      const rect = canvas.getBoundingClientRect();
      return { px: event.clientX - rect.left, py: event.clientY - rect.top };
    };
    const toWorld = (px: number, py: number) => ({
      x: (px - transform.x) / transform.k,
      y: (py - transform.y) / transform.k,
    });
    const nodeAt = (px: number, py: number) => {
      const world = toWorld(px, py);
      let found: SimNode | null = null;
      for (const node of nodes) {
        if (node.x == null || node.y == null) continue;
        const dx = world.x - node.x;
        const dy = world.y - node.y;
        const hit = node.radius + 3 / transform.k;
        if (dx * dx + dy * dy <= hit * hit) found = node;
      }
      return found;
    };

    let dragNode: SimNode | null = null;
    let panning = false;
    let panStart = { px: 0, py: 0, x: 0, y: 0 };
    let downPos = { px: 0, py: 0 };
    let moved = false;

    const onPointerDown = (event: PointerEvent) => {
      const { px, py } = pointerPos(event);
      downPos = { px, py };
      moved = false;
      canvas.setPointerCapture(event.pointerId);
      const hit = nodeAt(px, py);
      if (hit) {
        dragNode = hit;
        const world = toWorld(px, py);
        hit.fx = world.x;
        hit.fy = world.y;
        simulation.alphaTarget(0.3).restart();
      } else {
        panning = true;
        panStart = { px, py, x: transform.x, y: transform.y };
      }
    };

    const onPointerMove = (event: PointerEvent) => {
      const { px, py } = pointerPos(event);
      if (Math.hypot(px - downPos.px, py - downPos.py) > CLICK_SLOP)
        moved = true;

      if (dragNode) {
        const world = toWorld(px, py);
        dragNode.fx = world.x;
        dragNode.fy = world.y;
        needsDraw = true;
        return;
      }
      if (panning) {
        transform.x = panStart.x + (px - panStart.px);
        transform.y = panStart.y + (py - panStart.py);
        needsDraw = true;
        return;
      }
      const hit = nodeAt(px, py);
      const nextHover = hit?.id ?? null;
      if (nextHover !== hoveredId) {
        hoveredId = nextHover;
        needsDraw = true;
      }
      canvas.style.cursor = hit ? "pointer" : "grab";
    };

    const navigate = (node: SimNode) => {
      const base = resolveSectionBasePath(node.section);
      router.push(node.kind === "SECTION" ? base : `${base}/${node.id}`);
    };

    const onPointerUp = (event: PointerEvent) => {
      canvas.releasePointerCapture(event.pointerId);
      if (dragNode) {
        dragNode.fx = null;
        dragNode.fy = null;
        simulation.alphaTarget(0);
        if (!moved) navigate(dragNode);
        dragNode = null;
      }
      panning = false;
    };

    const onPointerLeave = () => {
      if (hoveredId) {
        hoveredId = null;
        needsDraw = true;
      }
    };

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const { px, py } = pointerPos(event);
      const world = toWorld(px, py);
      const factor = Math.exp(-event.deltaY * 0.0015);
      const nextK = Math.max(
        MIN_ZOOM,
        Math.min(transform.k * factor, MAX_ZOOM),
      );
      transform.k = nextK;
      transform.x = px - world.x * nextK;
      transform.y = py - world.y * nextK;
      needsDraw = true;
    };

    canvas.style.cursor = "grab";
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointerleave", onPointerLeave);
    canvas.addEventListener("wheel", onWheel, { passive: false });

    const resizeObserver = new ResizeObserver(() => {
      applySize();
      fit();
    });
    resizeObserver.observe(container);

    const themeObserver = new MutationObserver(readColors);
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    themeObserver.observe(document.body, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => {
      cancelAnimationFrame(raf);
      simulation.stop();
      resizeObserver.disconnect();
      themeObserver.disconnect();
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointerleave", onPointerLeave);
      canvas.removeEventListener("wheel", onWheel);
    };
  }, [data, router]);

  return (
    <div ref={containerRef} className="absolute inset-0">
      <canvas ref={canvasRef} className="size-full touch-none" />
    </div>
  );
}
