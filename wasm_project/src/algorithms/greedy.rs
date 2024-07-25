use wasm_bindgen::prelude::*;
use svg::Document;
use svg::node::element::Rectangle;

struct RGBGrid(Vec<Vec<(u64, u64, u64)>>);
impl RGBGrid {
    fn new(width: usize, height: usize, rgb_data: &[u64]) -> Self {
        let mut rgb_grid = vec![vec![(0, 0, 0); width + 1]; height + 1];
        for y in 0..height {
            for x in 0..width {
                let idx = (y * width + x) * 3;
                rgb_grid[y + 1][x + 1] = (rgb_data[idx], rgb_data[idx + 1], rgb_data[idx + 2]);
            }
        }
        // compute cumulative sum
        for y in 1..=height {
            for x in 1..=width {
                rgb_grid[y][x].0 += rgb_grid[y][x - 1].0 + rgb_grid[y - 1][x].0 - rgb_grid[y - 1][x - 1].0;
                rgb_grid[y][x].1 += rgb_grid[y][x - 1].1 + rgb_grid[y - 1][x].1 - rgb_grid[y - 1][x - 1].1;
                rgb_grid[y][x].2 += rgb_grid[y][x - 1].2 + rgb_grid[y - 1][x].2 - rgb_grid[y - 1][x - 1].2;
            }
        }
        Self(rgb_grid)
    }
    fn get_sum(&self, top: usize, left: usize, bottom: usize, right: usize) -> (u64, u64, u64) {
        (
            self.0[bottom][right].0 - self.0[bottom][left].0 - self.0[top][right].0 + self.0[top][left].0,
            self.0[bottom][right].1 - self.0[bottom][left].1 - self.0[top][right].1 + self.0[top][left].1,
            self.0[bottom][right].2 - self.0[bottom][left].2 - self.0[top][right].2 + self.0[top][left].2,
        )
    }
}

#[wasm_bindgen]
pub fn run_greedy(num_rectangles: usize, width: usize, height: usize, rgb_data: &[u8]) -> Vec<String> {
    let rgb_data = rgb_data.iter().map(|&x| x as u64).collect::<Vec<u64>>();
    let rgb_squared_data = rgb_data.iter().map(|&x| x * x).collect::<Vec<u64>>();

    let rgb_grid = RGBGrid::new(width, height, &rgb_data);
    let rgb_grid_squared = RGBGrid::new(width, height, &rgb_squared_data);

    let mut animation_data = vec![];

    let mut rectangles = vec![(0, 0, height, width)]; // top-left, bottom-right
    for _ in 0..num_rectangles {
        let mut best_cost = 0;
        let mut best_idx = 0;
        let mut best_yx = (0, 0);
        for (idx, &(top, left, bottom, right)) in rectangles.iter().enumerate() {
            let (r_sum, g_sum, b_sum) = rgb_grid.get_sum(top, left, bottom, right);
            let (r_square_sum, g_square_sum, b_square_sum) = rgb_grid_squared.get_sum(top, left, bottom, right);
            // original rectangle
            let area = ((bottom - top) * (right - left)) as f64;
            let mut original_cost = 0;
            original_cost += r_square_sum - (r_sum.pow(2) as f64 / area).round() as u64;
            original_cost += g_square_sum - (g_sum.pow(2) as f64 / area).round() as u64;
            original_cost += b_square_sum - (b_sum.pow(2) as f64 / area).round() as u64;

            for y in top + 1..bottom {
                // top rectangle
                let (r_sum, g_sum, b_sum) = rgb_grid.get_sum(top, left, y, right);
                let (r_square_sum, g_square_sum, b_square_sum) = rgb_grid_squared.get_sum(top, left, y, right);
                let area = ((y - top) * (right - left)) as f64;
                let mut top_cost = 0;
                top_cost += r_square_sum - (r_sum.pow(2) as f64 / area).round() as u64;
                top_cost += g_square_sum - (g_sum.pow(2) as f64 / area).round() as u64;
                top_cost += b_square_sum - (b_sum.pow(2) as f64 / area).round() as u64;
                // bottom rectangle
                let (r_sum, g_sum, b_sum) = rgb_grid.get_sum(y, left, bottom, right);
                let (r_square_sum, g_square_sum, b_square_sum) = rgb_grid_squared.get_sum(y, left, bottom, right);
                let area = ((bottom - y) * (right - left)) as f64;
                let mut bottom_cost = 0;
                bottom_cost += r_square_sum - (r_sum.pow(2) as f64 / area).round() as u64;
                bottom_cost += g_square_sum - (g_sum.pow(2) as f64 / area).round() as u64;
                bottom_cost += b_square_sum - (b_sum.pow(2) as f64 / area).round() as u64;

                if original_cost - (top_cost + bottom_cost) > best_cost {
                    best_cost = original_cost - (top_cost + bottom_cost);
                    best_idx = idx;
                    best_yx = (y, 0);
                }
            }
            for x in left + 1..right {
                // left rectangle
                let (r_sum, g_sum, b_sum) = rgb_grid.get_sum(top, left, bottom, x);
                let (r_square_sum, g_square_sum, b_square_sum) = rgb_grid_squared.get_sum(top, left, bottom, x);
                let area = ((bottom - top) * (x - left)) as f64;
                let mut left_cost = 0;
                left_cost += r_square_sum - (r_sum.pow(2) as f64 / area).round() as u64;
                left_cost += g_square_sum - (g_sum.pow(2) as f64 / area).round() as u64;
                left_cost += b_square_sum - (b_sum.pow(2) as f64 / area).round() as u64;
                // right rectangle
                let (r_sum, g_sum, b_sum) = rgb_grid.get_sum(top, x, bottom, right);
                let (r_square_sum, g_square_sum, b_square_sum) = rgb_grid_squared.get_sum(top, x, bottom, right);
                let area = ((bottom - top) * (right - x)) as f64;
                let mut right_cost = 0;
                right_cost += r_square_sum - (r_sum.pow(2) as f64 / area).round() as u64;
                right_cost += g_square_sum - (g_sum.pow(2) as f64 / area).round() as u64;
                right_cost += b_square_sum - (b_sum.pow(2) as f64 / area).round() as u64;

                if original_cost - (left_cost + right_cost) > best_cost {
                    best_cost = original_cost - (left_cost + right_cost);
                    best_idx = idx;
                    best_yx = (0, x);
                }
            }
        }

        let (top, left, bottom, right) = rectangles[best_idx]; // old rectangle
        match best_yx {
            (y, 0) => {
                rectangles[best_idx] = (top, left, y, right); // splitted top rectangle
                rectangles.push((y, left, bottom, right)); // splitted bottom rectangle
            }
            (0, x) => {
                rectangles[best_idx] = (top, left, bottom, x); // splitted left rectangle
                rectangles.push((top, x, bottom, right)); // splitted right rectangle
            }
            _ => (), // reachable, but no action needed as the rectangle is fully splitted
        }

        let mut svg = Document::new()
            .set("viewBox", (-5, -5, width + 5, height + 5))
            .set("width", width)
            .set("height", height);
        for &(top, left, bottom, right) in rectangles.iter() {
            let (r_sum, g_sum, b_sum) = rgb_grid.get_sum(top, left, bottom, right);
            let area = ((bottom - top) * (right - left)) as f64;
            let r = (r_sum as f64 / area).round() as u8;
            let g = (g_sum as f64 / area).round() as u8;
            let b = (b_sum as f64 / area).round() as u8;
            svg = svg.add(
                Rectangle::new()
                    .set("y", top)
                    .set("x", left)
                    .set("height", bottom - top)
                    .set("width", right - left)
                    .set("fill", format!("rgb({}, {}, {})", r, g, b).as_str())
                    // .set("stroke", "black")
                    // .set("stroke-width", 1),
            )
        }
        animation_data.push(svg.to_string());
    }
    animation_data
}
