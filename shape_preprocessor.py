#!/usr/bin/env python3
"""
Terra Tech Packs - Shape Preprocessor
Generates optimized shape data with pre-computed mesh points for fast rendering.
"""

import json
import math
import re
from dataclasses import dataclass, field
from typing import List, Tuple, Dict, Optional
from pathlib import Path
import argparse


@dataclass
class Point:
    x: float
    y: float


@dataclass
class PathCommand:
    type: str
    args: List[float]


class SVGPathParser:
    """Parse SVG path data into commands."""
    
    COMMAND_REGEX = re.compile(r'([MmLlHhVvCcSsQqTtAaZz])([^MmLlHhVvCcSsQqTtAaZz]*)')
    NUMBER_REGEX = re.compile(r'-?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?')
    
    @staticmethod
    def parse(path_data: str) -> List[PathCommand]:
        commands = []
        for match in SVGPathParser.COMMAND_REGEX.finditer(path_data):
            cmd_type = match.group(1)
            args_str = match.group(2).strip()
            args = [float(n) for n in SVGPathParser.NUMBER_REGEX.findall(args_str)]
            commands.append(PathCommand(type=cmd_type, args=args))
        return commands
    
    @staticmethod
    def to_absolute(commands: List[PathCommand]) -> List[PathCommand]:
        """Convert all commands to absolute coordinates."""
        result = []
        current_x, current_y = 0.0, 0.0
        start_x, start_y = 0.0, 0.0
        
        for cmd in commands:
            new_type = cmd.type.upper()
            new_args = list(cmd.args)
            is_relative = cmd.type.islower()
            
            if cmd.type in 'Mm':
                if is_relative:
                    new_args[0] += current_x
                    new_args[1] += current_y
                current_x, current_y = new_args[0], new_args[1]
                start_x, start_y = current_x, current_y
                
            elif cmd.type in 'Ll':
                if is_relative:
                    new_args[0] += current_x
                    new_args[1] += current_y
                current_x, current_y = new_args[0], new_args[1]
                
            elif cmd.type in 'Hh':
                if is_relative:
                    new_args[0] += current_x
                new_args = [new_args[0], current_y]
                new_type = 'L'
                current_x = new_args[0]
                
            elif cmd.type in 'Vv':
                if is_relative:
                    new_args[0] += current_y
                new_args = [current_x, new_args[0]]
                new_type = 'L'
                current_y = new_args[1]
                
            elif cmd.type in 'Cc':
                if is_relative:
                    for i in range(0, 6, 2):
                        new_args[i] += current_x
                        new_args[i + 1] += current_y
                current_x, current_y = new_args[4], new_args[5]
                
            elif cmd.type in 'Ss':
                if is_relative:
                    for i in range(0, 4, 2):
                        new_args[i] += current_x
                        new_args[i + 1] += current_y
                current_x, current_y = new_args[2], new_args[3]
                
            elif cmd.type in 'Qq':
                if is_relative:
                    for i in range(0, 4, 2):
                        new_args[i] += current_x
                        new_args[i + 1] += current_y
                current_x, current_y = new_args[2], new_args[3]
                
            elif cmd.type in 'Tt':
                if is_relative:
                    new_args[0] += current_x
                    new_args[1] += current_y
                current_x, current_y = new_args[0], new_args[1]
                
            elif cmd.type in 'Aa':
                if is_relative:
                    new_args[5] += current_x
                    new_args[6] += current_y
                current_x, current_y = new_args[5], new_args[6]
                
            elif cmd.type in 'Zz':
                current_x, current_y = start_x, start_y
            
            result.append(PathCommand(type=new_type, args=new_args))
        
        return result


class PathSampler:
    """Sample points along an SVG path at high resolution."""
    
    def __init__(self, path_data: str, num_samples: int = 1000):
        self.path_data = path_data
        self.num_samples = num_samples
        self.points: List[Point] = []
        self.cumulative_lengths: List[float] = []
        self.total_length = 0.0
        self._build_lookup_table()
    
    def _build_lookup_table(self):
        """Build a lookup table of points along the path."""
        commands = SVGPathParser.parse(self.path_data)
        absolute_commands = SVGPathParser.to_absolute(commands)
        
        raw_points = self._trace_path(absolute_commands)
        
        if len(raw_points) < 2:
            return
        
        # Calculate cumulative lengths
        lengths = [0.0]
        for i in range(1, len(raw_points)):
            dx = raw_points[i].x - raw_points[i-1].x
            dy = raw_points[i].y - raw_points[i-1].y
            lengths.append(lengths[-1] + math.sqrt(dx*dx + dy*dy))
        
        self.total_length = lengths[-1]
        
        if self.total_length == 0:
            return
        
        # Resample at uniform intervals
        self.points = []
        self.cumulative_lengths = []
        
        for i in range(self.num_samples + 1):
            target_length = (i / self.num_samples) * self.total_length
            point = self._interpolate_at_length(raw_points, lengths, target_length)
            self.points.append(point)
            self.cumulative_lengths.append(target_length)
    
    def _trace_path(self, commands: List[PathCommand], segments_per_curve: int = 50) -> List[Point]:
        """Trace the path and generate points."""
        points = []
        current = Point(0, 0)
        last_control = Point(0, 0)
        
        for cmd in commands:
            if cmd.type == 'M':
                current = Point(cmd.args[0], cmd.args[1])
                points.append(current)
                last_control = current
                
            elif cmd.type == 'L':
                end = Point(cmd.args[0], cmd.args[1])
                # Add intermediate points for lines too (for better sampling)
                for i in range(1, 11):
                    t = i / 10
                    points.append(Point(
                        current.x + (end.x - current.x) * t,
                        current.y + (end.y - current.y) * t
                    ))
                current = end
                last_control = current
                
            elif cmd.type == 'C':
                p0 = current
                p1 = Point(cmd.args[0], cmd.args[1])
                p2 = Point(cmd.args[2], cmd.args[3])
                p3 = Point(cmd.args[4], cmd.args[5])
                
                for i in range(1, segments_per_curve + 1):
                    t = i / segments_per_curve
                    points.append(self._cubic_bezier(p0, p1, p2, p3, t))
                
                current = p3
                last_control = p2
                
            elif cmd.type == 'S':
                p0 = current
                p1 = Point(2 * current.x - last_control.x, 2 * current.y - last_control.y)
                p2 = Point(cmd.args[0], cmd.args[1])
                p3 = Point(cmd.args[2], cmd.args[3])
                
                for i in range(1, segments_per_curve + 1):
                    t = i / segments_per_curve
                    points.append(self._cubic_bezier(p0, p1, p2, p3, t))
                
                current = p3
                last_control = p2
                
            elif cmd.type == 'Q':
                p0 = current
                p1 = Point(cmd.args[0], cmd.args[1])
                p2 = Point(cmd.args[2], cmd.args[3])
                
                for i in range(1, segments_per_curve + 1):
                    t = i / segments_per_curve
                    points.append(self._quadratic_bezier(p0, p1, p2, t))
                
                current = p2
                last_control = p1
                
            elif cmd.type == 'T':
                p0 = current
                p1 = Point(2 * current.x - last_control.x, 2 * current.y - last_control.y)
                p2 = Point(cmd.args[0], cmd.args[1])
                
                for i in range(1, segments_per_curve + 1):
                    t = i / segments_per_curve
                    points.append(self._quadratic_bezier(p0, p1, p2, t))
                
                current = p2
                last_control = p1
                
            elif cmd.type == 'A':
                arc_points = self._arc_to_points(
                    current,
                    cmd.args[0], cmd.args[1],  # rx, ry
                    cmd.args[2],  # x-axis-rotation
                    int(cmd.args[3]),  # large-arc-flag
                    int(cmd.args[4]),  # sweep-flag
                    Point(cmd.args[5], cmd.args[6]),  # end point
                    segments_per_curve
                )
                points.extend(arc_points[1:])
                current = Point(cmd.args[5], cmd.args[6])
                last_control = current
        
        return points
    
    def _cubic_bezier(self, p0: Point, p1: Point, p2: Point, p3: Point, t: float) -> Point:
        mt = 1 - t
        mt2 = mt * mt
        mt3 = mt2 * mt
        t2 = t * t
        t3 = t2 * t
        
        return Point(
            mt3 * p0.x + 3 * mt2 * t * p1.x + 3 * mt * t2 * p2.x + t3 * p3.x,
            mt3 * p0.y + 3 * mt2 * t * p1.y + 3 * mt * t2 * p2.y + t3 * p3.y
        )
    
    def _quadratic_bezier(self, p0: Point, p1: Point, p2: Point, t: float) -> Point:
        mt = 1 - t
        mt2 = mt * mt
        t2 = t * t
        
        return Point(
            mt2 * p0.x + 2 * mt * t * p1.x + t2 * p2.x,
            mt2 * p0.y + 2 * mt * t * p1.y + t2 * p2.y
        )
    
    def _arc_to_points(self, start: Point, rx: float, ry: float, 
                       x_rotation: float, large_arc: int, sweep: int,
                       end: Point, segments: int) -> List[Point]:
        """Convert arc to points using parametric approach."""
        if rx == 0 or ry == 0:
            return [start, end]
        
        phi = math.radians(x_rotation)
        cos_phi = math.cos(phi)
        sin_phi = math.sin(phi)
        
        # Compute center parameterization
        dx = (start.x - end.x) / 2
        dy = (start.y - end.y) / 2
        
        x1p = cos_phi * dx + sin_phi * dy
        y1p = -sin_phi * dx + cos_phi * dy
        
        # Correct radii if needed
        lambda_sq = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry)
        if lambda_sq > 1:
            scale = math.sqrt(lambda_sq)
            rx *= scale
            ry *= scale
        
        # Compute center point
        rx_sq, ry_sq = rx * rx, ry * ry
        x1p_sq, y1p_sq = x1p * x1p, y1p * y1p
        
        sq = max(0, (rx_sq * ry_sq - rx_sq * y1p_sq - ry_sq * x1p_sq) / 
                    (rx_sq * y1p_sq + ry_sq * x1p_sq))
        sq = math.sqrt(sq)
        if large_arc == sweep:
            sq = -sq
        
        cxp = sq * rx * y1p / ry
        cyp = -sq * ry * x1p / rx
        
        cx = cos_phi * cxp - sin_phi * cyp + (start.x + end.x) / 2
        cy = sin_phi * cxp + cos_phi * cyp + (start.y + end.y) / 2
        
        # Compute angles
        def angle(ux, uy, vx, vy):
            n = math.sqrt(ux*ux + uy*uy) * math.sqrt(vx*vx + vy*vy)
            c = (ux*vx + uy*vy) / n if n != 0 else 0
            c = max(-1, min(1, c))
            a = math.acos(c)
            if ux * vy - uy * vx < 0:
                a = -a
            return a
        
        theta1 = angle(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry)
        dtheta = angle((x1p - cxp) / rx, (y1p - cyp) / ry,
                      (-x1p - cxp) / rx, (-y1p - cyp) / ry)
        
        if sweep == 0 and dtheta > 0:
            dtheta -= 2 * math.pi
        elif sweep == 1 and dtheta < 0:
            dtheta += 2 * math.pi
        
        # Generate points
        points = [start]
        for i in range(1, segments + 1):
            t = i / segments
            theta = theta1 + dtheta * t
            xp = rx * math.cos(theta)
            yp = ry * math.sin(theta)
            x = cos_phi * xp - sin_phi * yp + cx
            y = sin_phi * xp + cos_phi * yp + cy
            points.append(Point(x, y))
        
        return points
    
    def _interpolate_at_length(self, points: List[Point], lengths: List[float], 
                               target_length: float) -> Point:
        """Interpolate point at specific arc length."""
        if target_length <= 0:
            return points[0]
        if target_length >= lengths[-1]:
            return points[-1]
        
        # Binary search for segment
        lo, hi = 0, len(lengths) - 1
        while lo < hi - 1:
            mid = (lo + hi) // 2
            if lengths[mid] <= target_length:
                lo = mid
            else:
                hi = mid
        
        # Interpolate within segment
        segment_start = lengths[lo]
        segment_end = lengths[hi]
        segment_length = segment_end - segment_start
        
        if segment_length == 0:
            return points[lo]
        
        t = (target_length - segment_start) / segment_length
        
        return Point(
            points[lo].x + (points[hi].x - points[lo].x) * t,
            points[lo].y + (points[hi].y - points[lo].y) * t
        )
    
    def get_point_at(self, percentage: float) -> Point:
        """Get point at percentage (0-1) along path."""
        if not self.points:
            return Point(0, 0)
        
        percentage = max(0, min(1, percentage))
        
        if percentage == 0:
            return self.points[0]
        if percentage == 1:
            return self.points[-1]
        
        target_length = percentage * self.total_length
        
        # Binary search
        lo, hi = 0, len(self.cumulative_lengths) - 1
        while lo < hi - 1:
            mid = (lo + hi) // 2
            if self.cumulative_lengths[mid] <= target_length:
                lo = mid
            else:
                hi = mid
        
        # Interpolate
        len_lo = self.cumulative_lengths[lo]
        len_hi = self.cumulative_lengths[hi]
        
        if len_hi == len_lo:
            return self.points[lo]
        
        t = (target_length - len_lo) / (len_hi - len_lo)
        
        return Point(
            self.points[lo].x + (self.points[hi].x - self.points[lo].x) * t,
            self.points[lo].y + (self.points[hi].y - self.points[lo].y) * t
        )


class MeshGenerator:
    """Generate warping mesh for a shape."""
    
    def __init__(self, top_path: str, bottom_path: str, 
                 source_width: float, source_height: float,
                 grid_cols: int = 100, grid_rows: int = 40,
                 top_reversed: bool = False, bottom_reversed: bool = False):
        self.top_sampler = PathSampler(top_path, num_samples=2000)
        self.bottom_sampler = PathSampler(bottom_path, num_samples=2000)
        self.source_width = source_width
        self.source_height = source_height
        self.grid_cols = grid_cols
        self.grid_rows = grid_rows
        self.top_reversed = top_reversed
        self.bottom_reversed = bottom_reversed
    
    def generate_mesh(self) -> List[List[Dict[str, float]]]:
        """Generate the warping mesh."""
        mesh = []
        
        for row in range(self.grid_rows + 1):
            row_points = []
            v = row / self.grid_rows
            
            for col in range(self.grid_cols + 1):
                u = col / self.grid_cols
                
                t_top = 1 - u if self.top_reversed else u
                t_bot = 1 - u if self.bottom_reversed else u
                
                t_top = max(0, min(1, t_top))
                t_bot = max(0, min(1, t_bot))
                
                top_point = self.top_sampler.get_point_at(t_top)
                bottom_point = self.bottom_sampler.get_point_at(t_bot)
                
                # Smooth interpolation using cosine for better curve quality
                smooth_v = 0.5 - 0.5 * math.cos(math.pi * v) if False else v  # Can enable cosine interp
                
                x = top_point.x + (bottom_point.x - top_point.x) * v
                y = top_point.y + (bottom_point.y - top_point.y) * v
                
                row_points.append({
                    'x': round(x, 4),
                    'y': round(y, 4),
                    'u': round(u, 6),
                    'v': round(v, 6)
                })
            
            mesh.append(row_points)
        
        return mesh
    
    def generate_sampled_paths(self, num_samples: int = 500) -> Dict:
        """Generate pre-sampled path points for fast lookup."""
        top_points = []
        bottom_points = []
        
        for i in range(num_samples + 1):
            t = i / num_samples
            
            top_pt = self.top_sampler.get_point_at(t)
            bottom_pt = self.bottom_sampler.get_point_at(t)
            
            top_points.append({'x': round(top_pt.x, 4), 'y': round(top_pt.y, 4)})
            bottom_points.append({'x': round(bottom_pt.x, 4), 'y': round(bottom_pt.y, 4)})
        
        return {
            'top': top_points,
            'bottom': bottom_points,
            'topLength': round(self.top_sampler.total_length, 4),
            'bottomLength': round(self.bottom_sampler.total_length, 4)
        }


def preprocess_shapes(shapes: Dict, output_path: str, 
                      preview_cols: int = 50, preview_rows: int = 20,
                      export_cols: int = 120, export_rows: int = 50):
    """Preprocess all shapes and generate optimized data."""
    
    processed = {}
    
    for key, shape in shapes.items():
        print(f"Processing: {key}")
        
        if 'topPath' not in shape or 'bottomPath' not in shape:
            processed[key] = shape
            continue
        
        source_width = shape.get('uploadDimensions', {}).get('width', 1000)
        source_height = shape.get('uploadDimensions', {}).get('height', 500)
        
        # Generate preview mesh (lower resolution for fast display)
        preview_gen = MeshGenerator(
            shape['topPath'], shape['bottomPath'],
            source_width, source_height,
            preview_cols, preview_rows,
            shape.get('topIsReversed', False),
            shape.get('bottomIsReversed', False)
        )
        
        # Generate export mesh (higher resolution for quality exports)
        export_gen = MeshGenerator(
            shape['topPath'], shape['bottomPath'],
            source_width, source_height,
            export_cols, export_rows,
            shape.get('topIsReversed', False),
            shape.get('bottomIsReversed', False)
        )
        
        # Generate sampled paths
        sampled_paths = preview_gen.generate_sampled_paths(500)
        
        processed[key] = {
            **shape,
            'previewMesh': preview_gen.generate_mesh(),
            'exportMesh': export_gen.generate_mesh(),
            'sampledPaths': sampled_paths,
            'meshConfig': {
                'previewCols': preview_cols,
                'previewRows': preview_rows,
                'exportCols': export_cols,
                'exportRows': export_rows
            }
        }
    
    # Write output
    output = {
        'version': '2.0',
        'generated': True,
        'shapes': processed
    }
    
    with open(output_path, 'w') as f:
        json.dump(output, f)
    
    # Also generate minified version
    min_path = output_path.replace('.json', '.min.json')
    with open(min_path, 'w') as f:
        json.dump(output, f, separators=(',', ':'))
    
    print(f"Wrote: {output_path}")
    print(f"Wrote: {min_path}")
    
    return processed


# Example shapes for testing
SAMPLE_SHAPES = {
    "250ml_round": {
        "type": "round",
        "view": "bottom",
        "name": "250ml Round",
        "width": 837,
        "height": 244,
        "uploadDimensions": {"width": 2908, "height": 448},
        "path": "M1.37,162.42L73.32,242.27C283.84,56.41,576.84,75.5,764.01,242.27L835.96,162.42C597.61,-50.29,240.85,-53.15,1.37,162.42Z",
        "topPath": "M 835.96,162.42 C 597.61,-50.29 240.85,-53.15 1.37,162.42",
        "bottomPath": "M 73.32,242.27 C 283.84,56.41 576.84,75.5 764.01,242.27",
        "topIsReversed": True,
        "bottomIsReversed": False,
        "modelPath": "./assets/models/250ml_round_t.glb",
        "targetMaterials": ["Texture"]
    },
    "300ml_round": {
        "type": "round",
        "view": "bottom",
        "name": "300ml Round",
        "width": 986.98,
        "height": 332.17,
        "uploadDimensions": {"width": 2906, "height": 448},
        "path": "M892.85,294.57c-257.8-94.83-540.94-94.83-798.75,0l-5.32,1.98-45.71-122.15,6.01-2.21c286.86-105.52,601.92-105.52,888.78,0l6.04,2.15-45.75,122.2-5.3-1.98Z",
        "topPath": "M49.08,172.19c286.86-105.52,601.92-105.52,888.78,0",
        "bottomPath": "M892.85,294.57c-257.8-94.83-540.94-94.83-798.75,0",
        "topIsReversed": False,
        "bottomIsReversed": True,
        "modelPath": "./assets/models/300ml_round_container.glb",
        "targetMaterials": ["Texture"]
    }
}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Preprocess shapes for Terra Tech Packs')
    parser.add_argument('--input', '-i', help='Input JSON file with shapes', default=None)
    parser.add_argument('--output', '-o', help='Output JSON file', default='shapes_preprocessed.json')
    parser.add_argument('--preview-cols', type=int, default=50, help='Preview mesh columns')
    parser.add_argument('--preview-rows', type=int, default=20, help='Preview mesh rows')
    parser.add_argument('--export-cols', type=int, default=120, help='Export mesh columns')
    parser.add_argument('--export-rows', type=int, default=50, help='Export mesh rows')
    
    args = parser.parse_args()
    
    if args.input:
        with open(args.input, 'r') as f:
            shapes = json.load(f)
    else:
        shapes = SAMPLE_SHAPES
        print("Using sample shapes (no input file provided)")
    
    preprocess_shapes(
        shapes, 
        args.output,
        args.preview_cols,
        args.preview_rows,
        args.export_cols,
        args.export_rows
    )