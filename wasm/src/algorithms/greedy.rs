use crate::Rect;
use std::collections::BinaryHeap;

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

#[derive(Clone, Copy, Eq, PartialEq)]
enum SplitLine {
    Horizontal(usize), // 1..height
    Vertical(usize),   // 1..width
}

#[derive(Clone, Copy, Eq, PartialEq)]
struct Rectangle {
    top: usize,
    left: usize,
    bottom: usize,
    right: usize,
}

impl Rectangle {
    #[rustfmt::skip]
    fn find_best_split(&self, rgb_grid: &RGBGrid, rgb_squared_grid: &RGBGrid) -> (SplitLine, u64) {
        let mut best_split_line = SplitLine::Horizontal(self.top);
        let mut best_cost = 0;
        let (r_sum, g_sum, b_sum) = rgb_grid.get_sum(self.top, self.left, self.bottom, self.right);
        let (r_square_sum, g_square_sum, b_square_sum) = rgb_squared_grid.get_sum(self.top, self.left, self.bottom, self.right);
        let area = ((self.bottom - self.top) * (self.right - self.left)) as u64;
        let original_cost = r_square_sum - r_sum.pow(2) / area + g_square_sum - g_sum.pow(2) / area + b_square_sum - b_sum.pow(2) / area;
        // evaluate horizontal splits
        for y in self.top + 1..self.bottom {
            // top rectangle
            let (r_sum_top, g_sum_top, b_sum_top) = rgb_grid.get_sum(self.top, self.left, y, self.right);
            let (r_square_sum_top, g_square_sum_top, b_square_sum_top) = rgb_squared_grid.get_sum(self.top, self.left, y, self.right);
            let area_top = ((y - self.top) * (self.right - self.left)) as u64;
            let top_cost = r_square_sum_top - r_sum_top.pow(2) / area_top + g_square_sum_top - g_sum_top.pow(2) / area_top + b_square_sum_top - b_sum_top.pow(2) / area_top;
            // bottom rectangle
            let (r_sum_bottom, g_sum_bottom, b_sum_bottom) = rgb_grid.get_sum(y, self.left, self.bottom, self.right);
            let (r_square_sum_bottom, g_square_sum_bottom, b_square_sum_bottom) = rgb_squared_grid.get_sum(y, self.left, self.bottom, self.right);
            let area_bottom = ((self.bottom - y) * (self.right - self.left)) as u64;
            let bottom_cost = r_square_sum_bottom - r_sum_bottom.pow(2) / area_bottom + g_square_sum_bottom - g_sum_bottom.pow(2) / area_bottom + b_square_sum_bottom - b_sum_bottom.pow(2) / area_bottom;

            if original_cost - (top_cost + bottom_cost) > best_cost {
                best_cost = original_cost - (top_cost + bottom_cost);
                best_split_line = SplitLine::Horizontal(y);
            }
        }
        // evaluate vertical splits
        for x in self.left + 1..self.right {
            // left rectangle
            let (r_sum_left, g_sum_left, b_sum_left) = rgb_grid.get_sum(self.top, self.left, self.bottom, x);
            let (r_square_sum_left, g_square_sum_left, b_square_sum_left) = rgb_squared_grid.get_sum(self.top, self.left, self.bottom, x);
            let area_left = ((self.bottom - self.top) * (x - self.left)) as u64;
            let left_cost = r_square_sum_left - r_sum_left.pow(2) / area_left + g_square_sum_left - g_sum_left.pow(2) / area_left + b_square_sum_left - b_sum_left.pow(2) / area_left;
            // right rectangle
            let (r_sum_right, g_sum_right, b_sum_right) = rgb_grid.get_sum(self.top, x, self.bottom, self.right);
            let (r_square_sum_right, g_square_sum_right, b_square_sum_right) = rgb_squared_grid.get_sum(self.top, x, self.bottom, self.right);
            let area_right = ((self.bottom - self.top) * (self.right - x)) as u64;
            let right_cost = r_square_sum_right - r_sum_right.pow(2) / area_right + g_square_sum_right - g_sum_right.pow(2) / area_right + b_square_sum_right - b_sum_right.pow(2) / area_right;

            if original_cost - (left_cost + right_cost) > best_cost {
                best_cost = original_cost - (left_cost + right_cost);
                best_split_line = SplitLine::Vertical(x);
            }
        }
        (best_split_line, best_cost)
    }
    fn split(&self, split_line: SplitLine) -> (Rectangle, Rectangle) {
        match split_line {
            SplitLine::Horizontal(y) => (
                Rectangle {
                    top: self.top,
                    left: self.left,
                    bottom: y,
                    right: self.right,
                },
                Rectangle {
                    top: y,
                    left: self.left,
                    bottom: self.bottom,
                    right: self.right,
                },
            ),
            SplitLine::Vertical(x) => (
                Rectangle {
                    top: self.top,
                    left: self.left,
                    bottom: self.bottom,
                    right: x,
                },
                Rectangle {
                    top: self.top,
                    left: x,
                    bottom: self.bottom,
                    right: self.right,
                },
            ),
        }
    }
}

#[derive(Clone, Copy, PartialEq, Eq)]
struct RectangleSplit {
    rectangle: Rectangle,
    split_line: SplitLine,
    cost_decrease: u64,
}

impl RectangleSplit {
    fn new(rectangle: Rectangle, split_line: SplitLine, cost_decrease: u64) -> Self {
        Self {
            rectangle,
            split_line,
            cost_decrease,
        }
    }
}

impl Ord for RectangleSplit {
    fn cmp(&self, other: &Self) -> std::cmp::Ordering {
        self.cost_decrease.cmp(&other.cost_decrease)
    }
}

impl PartialOrd for RectangleSplit {
    fn partial_cmp(&self, other: &Self) -> Option<std::cmp::Ordering> {
        Some(self.cmp(other))
    }
}

pub fn run_greedy(num_rectangles: usize, width: usize, height: usize, rgb_data: &[u8]) -> Vec<Vec<Rect>> {
    let rgb_data = rgb_data.iter().map(|&x| x as u64).collect::<Vec<u64>>();
    let rgb_squared_data = rgb_data.iter().map(|&x| x * x).collect::<Vec<u64>>();

    let rgb_grid = RGBGrid::new(width, height, &rgb_data);
    let rgb_grid_squared = RGBGrid::new(width, height, &rgb_squared_data);

    let mut steps: Vec<Vec<Rect>> = vec![];

    let initial_rectangle = Rectangle {
        top: 0,
        left: 0,
        bottom: height,
        right: width,
    };
    let (split_line, cost_decrease) = initial_rectangle.find_best_split(&rgb_grid, &rgb_grid_squared);
    let mut rectangles_heap = BinaryHeap::new();
    rectangles_heap.push(RectangleSplit::new(initial_rectangle, split_line, cost_decrease));
    let mut step = vec![];
    for &rectangle_split in rectangles_heap.iter() {
        let Rectangle { top, left, bottom, right } = rectangle_split.rectangle;
        let (r_sum, g_sum, b_sum) = rgb_grid.get_sum(top, left, bottom, right);
        let area = ((bottom - top) * (right - left)) as u64;
        step.push(Rect {
            x1: left as u16,
            y1: top as u16,
            x2: right as u16,
            y2: bottom as u16,
            color: ((r_sum / area) as u32) << 16 | ((g_sum / area) as u32) << 8 | (b_sum / area) as u32,
        });
    }
    steps.push(step);

    while rectangles_heap.len() < num_rectangles {
        let RectangleSplit {
            rectangle,
            split_line,
            cost_decrease: _,
        } = rectangles_heap.pop().unwrap();
        let (rectangle1, rectangle2) = rectangle.split(split_line);
        let (split_line1, cost_decrease1) = rectangle1.find_best_split(&rgb_grid, &rgb_grid_squared);
        let (split_line2, cost_decrease2) = rectangle2.find_best_split(&rgb_grid, &rgb_grid_squared);
        rectangles_heap.push(RectangleSplit::new(rectangle1, split_line1, cost_decrease1));
        rectangles_heap.push(RectangleSplit::new(rectangle2, split_line2, cost_decrease2));

        let mut step = vec![];
        for &rectangle_split in rectangles_heap.iter() {
            let Rectangle { top, left, bottom, right } = rectangle_split.rectangle;
            let (r_sum, g_sum, b_sum) = rgb_grid.get_sum(top, left, bottom, right);
            let area = ((bottom - top) * (right - left)) as u64;
            step.push(Rect {
                x1: left as u16,
                y1: top as u16,
                x2: right as u16,
                y2: bottom as u16,
                color: ((r_sum / area) as u32) << 16 | ((g_sum / area) as u32) << 8 | (b_sum / area) as u32,
            });
        }
        steps.push(step);
    }
    steps
}
