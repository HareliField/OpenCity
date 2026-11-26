#include <algorithm>
#include <cmath>

// Orthographic raster for visibility and inverse UV projection. Each triangle
// is three (x,y,z) vertices. Pixel centres are integer coordinates on both passes.
extern "C" void raster(const float* vertices, int count, int width, int height,
                       int* identities, float* weights, float* depth) {
    for (int triangle = 0; triangle < count; ++triangle, vertices += 9) {
        const float ax = vertices[3] - vertices[0], ay = vertices[4] - vertices[1];
        const float bx = vertices[6] - vertices[0], by = vertices[7] - vertices[1];
        const float area = ax * by - ay * bx;
        if (std::abs(area) < .000001) continue;
        const int left = std::max(0, int(std::ceil(std::min({vertices[0], vertices[3], vertices[6]}))));
        const int right = std::min(width - 1, int(std::floor(std::max({vertices[0], vertices[3], vertices[6]}))));
        const int top = std::max(0, int(std::ceil(std::min({vertices[1], vertices[4], vertices[7]}))));
        const int bottom = std::min(height - 1, int(std::floor(std::max({vertices[1], vertices[4], vertices[7]}))));
        for (int y = top; y <= bottom; ++y) {
            for (int x = left; x <= right; ++x) {
                const float dx = x - vertices[0], dy = y - vertices[1];
                const float a = (dx * by - dy * bx) / area, b = (dy * ax - dx * ay) / area;
                if (a < 0 || b < 0 || a + b > 1) continue;
                const int pixel = y * width + x;
                const float z = vertices[2] + a * (vertices[5] - vertices[2]) + b * (vertices[8] - vertices[2]);
                if (z <= depth[pixel]) continue;
                depth[pixel] = z;
                identities[pixel] = triangle;
                weights[pixel * 2] = a;
                weights[pixel * 2 + 1] = b;
            }
        }
    }
}
