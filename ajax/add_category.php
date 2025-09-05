<?php
require_once '../config/database.php';
requireLogin();

header('Content-Type: application/json');

try {
    $db = Database::getInstance();
    $user_id = $_SESSION['user_id'];
    
    // Validate input
    $name = sanitizeInput($_POST['name'] ?? '');
    $icon = sanitizeInput($_POST['icon'] ?? 'fas fa-money-bill');
    $color = sanitizeInput($_POST['color'] ?? '#204cb0');
    
    if (empty($name)) {
        throw new Exception('Category name is required.');
    }
    
    // Check for duplicate category name
    $existing = $db->fetchOne(
        "SELECT id FROM categories WHERE name = ? AND user_id = ?",
        [$name, $user_id]
    );
    
    if ($existing) {
        throw new Exception('A category with this name already exists.');
    }
    
    // Insert new category
    $db->execute(
        "INSERT INTO categories (user_id, name, icon, color) VALUES (?, ?, ?, ?)",
        [$user_id, $name, $icon, $color]
    );
    
    $category_id = $db->lastInsertId();
    
    echo json_encode([
        'success' => true,
        'message' => 'Category added successfully',
        'category' => [
            'id' => $category_id,
            'name' => $name,
            'icon' => $icon,
            'color' => $color
        ]
    ]);
    
} catch (Exception $e) {
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage()
    ]);
}
?>