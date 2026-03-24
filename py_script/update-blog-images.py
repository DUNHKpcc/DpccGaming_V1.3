#!/usr/bin/env python3
"""
更新博客图片为优化版本
"""

import os
import shutil

def update_blog_images():
    """将原始图片替换为WebP优化版本"""
    source_dir = "public/Blog"
    
    # 定义文件名映射
    image_mappings = {
        'HeroSection_optimized.png': 'HeroSection.png',
        'LightSwitch_optimized.png': 'LightSwitch.png', 
        'GSAP_optimized.png': 'GSAP.png',
        'Coding_optimized.png': 'Coding.png',
        'Footer_optimized.png': 'Footer.png'
    }
    
    print("开始更新博客图片...")
    
    # 先备份原始文件
    for original_name in image_mappings.values():
        original_path = f"{source_dir}/{original_name}"
        backup_path = f"{source_dir}/{original_name.replace('.png', '_backup.png')}"
        if os.path.exists(original_path) and not os.path.exists(backup_path):
            shutil.copy2(original_path, backup_path)
            print(f"已备份: {original_name}")
    
    # 使用优化的PNG替换原始文件
    for optimized_name, original_name in image_mappings.items():
        optimized_path = f"{source_dir}/{optimized_name}"
        original_path = f"{source_dir}/{original_name}"
        
        if os.path.exists(optimized_path):
            shutil.copy2(optimized_path, original_path)
            print(f"已更新: {original_name}")
        else:
            print(f"警告: 找不到 {optimized_name}")
    
    print("图片更新完成!")

if __name__ == "__main__":
    update_blog_images()