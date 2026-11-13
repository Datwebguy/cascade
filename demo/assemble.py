#!/usr/bin/env python3
"""Assembles the demo: scales each recording to 1080p, lays each narration line at its recorded
start time, fades between parts, and joins everything into one MP4.
Usage: python3 demo/assemble.py <recordDir> <ttsDir> <output.mp4>"""
import json, os, subprocess, sys

rec, tts, out = sys.argv[1:4]
parts = json.load(open(os.path.join(rec, "timeline.json")))

def duration(path):
    return float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path]).strip())

built = []
def kept_spans(total, cuts):
    spans, pos = [], 0.0
    for a, b in sorted(cuts):
        if b - a < 0.3 or a >= total: continue
        spans.append((pos, a)); pos = b
    spans.append((pos, total))
    return [(a, b) for a, b in spans if b - a > 0.05]

def shift(t, cuts):
    return t - sum(min(b, t) - a for a, b in cuts if a < t)

def silence_cuts(lines, cuts, total, lead=0.25, tail=0.35, keep=0.12):
    """Cut every pause between narration lines (and long lead-ins/outs) so the voice flows."""
    def advance(t, dur):
        # walk forward `dur` seconds of kept (non-cut) time from t
        for a, b in sorted(cuts):
            if b <= t: continue
            if a > t + dur: break
            if a >= t: dur -= (a - t); t = b
            else: t = max(t, b)
        return t + dur
    extra = []
    if lines and lines[0][0] > lead: extra.append([0.0, lines[0][0] - lead])
    for (t, d), nxt in zip(lines, lines[1:] + [None]):
        end = advance(t, d)
        nt = nxt[0] if nxt else total
        pad = keep if nxt else tail
        if nt - end > pad * 2 + 0.05:
            extra.append([end + pad, nt - (keep if nxt else 0)])
    return extra

def merge(cs):
    out = []
    for a, b in sorted(cs):
        if out and a <= out[-1][1]: out[-1][1] = max(out[-1][1], b)
        else: out.append([a, b])
    return out

for p in parts:
    src = p["file"]
    total = duration(src)
    cuts = p.get("cuts", [])
    lines = [(l["t"], json.load(open(os.path.join(tts, "durations.json")))[l["id"]]) for l in p["timeline"]]
    is_last = p is parts[-1]
    cuts = merge(cuts + silence_cuts(lines, cuts, total, tail=1.4 if is_last else 0.35))
    spans = kept_spans(total, cuts)
    d = sum(b - a for a, b in spans)
    dst = os.path.join(rec, f"{p['name']}.mp4")
    inputs = ["-i", src]
    vparts = [f"[0:v]trim=start={a:.3f}:end={b:.3f},setpts=PTS-STARTPTS[v{i}]" for i, (a, b) in enumerate(spans)]
    filters = vparts + [f"{''.join(f'[v{i}]' for i in range(len(spans)))}concat=n={len(spans)}:v=1:a=0[vc]",
               f"[vc]scale=1920:1080:flags=lanczos,fps=30,format=yuv420p,fade=t=in:st=0:d=0.2:color=0xF6F5FB,fade=t=out:st={max(d-0.25,0):.2f}:d=0.25:color=0xF6F5FB,format=yuv420p[v]"]
    mix = []
    for i, line in enumerate(p["timeline"], start=1):
        inputs += ["-i", os.path.join(tts, f"{line['id']}.wav")]
        ms = int(shift(line["t"], cuts) * 1000)
        filters.append(f"[{i}:a]aresample=48000,aformat=channel_layouts=stereo,adelay={ms}|{ms}[a{i}]")
        mix.append(f"[a{i}]")
    filters.append(f"anullsrc=r=48000:cl=stereo,atrim=0:{d:.3f}[sil]")
    filters.append(f"[sil]{''.join(mix)}amix=inputs={len(mix)+1}:normalize=0:duration=first[a]")
    subprocess.run(["ffmpeg", "-v", "error", "-y", *inputs, "-filter_complex", ";".join(filters),
                    "-map", "[v]", "-map", "[a]", "-c:v", "libx264", "-preset", "medium", "-crf", "18",
                    "-pix_fmt", "yuv420p", "-profile:v", "high", "-level:v", "4.1",
                    "-c:a", "aac", "-b:a", "256k", "-t", f"{d:.3f}", dst], check=True)
    built.append(dst)
    print(f"{p['name']:8s} {total:6.2f}s -> {d:6.2f}s  ({len(cuts)} waits cut, {len(p['timeline'])} lines)")

lst = os.path.join(rec, "concat.txt")
open(lst, "w").write("".join(f"file '{b}'\n" for b in built))
subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", lst,
                "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p",
                "-profile:v", "high", "-level:v", "4.1", "-c:a", "aac", "-b:a", "192k", "-ar", "48000",
                "-movflags", "+faststart", out], check=True)
print("output", out, round(duration(out), 1), "s")
