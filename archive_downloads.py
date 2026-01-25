#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
智能文件归档系统 - 逻辑增强版
1. 文件夹格式对齐 (YYYY-MM-DD)
2. 逻辑递进：文件 -> 日 -> 周 -> 月
"""

import os
import shutil
import logging
import re
from datetime import datetime, timedelta
from pathlib import Path

# ==================== 用户配置区域 ====================
SOURCE_DIR = r"C:\Users\chen\Downloads"
LOG_TO_FILE = True
# =====================================================

def setup_logging():
    log_format = '%(asctime)s - %(levelname)s - %(message)s'
    handlers = [logging.StreamHandler()]
    if LOG_TO_FILE:
        log_path = Path(SOURCE_DIR).parent / "archive_manager.log"
        handlers.append(logging.FileHandler(log_path, encoding='utf-8'))
    logging.basicConfig(level=logging.INFO, format=log_format, handlers=handlers)
    return logging.getLogger("ArchiveExpert")

logger = setup_logging()

def get_week_of_month(dt):
    """计算日期属于当月的第几周"""
    first_day = dt.replace(day=1)
    dom = dt.day
    adjusted_dom = dom + first_day.weekday()
    return (adjusted_dom - 1) // 7 + 1

def is_archive_folder(name):
    """正则匹配识别归档文件夹"""
    # 匹配 YYYY-MM-DD, YYYY-MM-wN, YYYY-MM
    return bool(re.match(r"^\d{4}-\d{2}(-\d{2}|-w\d{1,2})?$", name))

def organize_files_to_day(source_path, today):
    """步骤 1: 将散落的文件/文件夹按修改时间移入 YYYY-MM-DD"""
    for item in source_path.iterdir():
        # 排除隐藏文件和已存在的归档目录
        if item.name.startswith('.') or (item.is_dir() and is_archive_folder(item.name)):
            continue
            
        mtime = datetime.fromtimestamp(item.stat().st_mtime).date()
        
        # 规则：不处理今天修改的项目
        if mtime >= today:
            continue

        day_str = mtime.strftime("%Y-%m-%d") # 格式如 2026-01-05
        day_path = source_path / day_str
        day_path.mkdir(exist_ok=True)
        
        target = day_path / item.name
        if not target.exists():
            try:
                shutil.move(str(item), str(target))
                logger.info(f"[日归档] {item.name} -> {day_str}")
            except Exception as e:
                logger.error(f"移动失败 {item.name}: {e}")

def organize_days_to_week(source_path, today):
    """步骤 2: 扫描所有日文件夹，将其移入对应的周文件夹"""
    for item in source_path.iterdir():
        if item.is_dir() and re.match(r"^\d{4}-\d{2}-\d{2}$", item.name):
            try:
                folder_date = datetime.strptime(item.name, "%Y-%m-%d").date()
                
                # 规则：为了保持周的完整性，不处理本周的日文件夹（直到下周一）
                # 如果你想立即归档，可以去掉下面这个判断
                if today - folder_date < timedelta(days=today.weekday() + 1):
                    continue

                week_num = get_week_of_month(folder_date)
                week_str = folder_date.strftime(f"%Y-%m-w{week_num}")
                week_path = source_path / week_str
                week_path.mkdir(exist_ok=True)
                
                shutil.move(str(item), str(week_path / item.name))
                logger.info(f"[周整合] {item.name} -> {week_str}")
            except Exception as e:
                logger.error(f"周整合错误 {item.name}: {e}")

def organize_weeks_to_month(source_path, today):
    """步骤 3: 扫描所有周文件夹，将非本月的移入月文件夹"""
    for item in source_path.iterdir():
        # 匹配日期文件夹或周文件夹
        if item.is_dir() and (re.match(r"^\d{4}-\d{2}-w\d{1,2}$", item.name) or 
                              re.match(r"^\d{4}-\d{2}-\d{2}$", item.name)):
            try:
                # 提取年份和月份
                parts = item.name.split('-')
                item_year, item_month = int(parts[0]), int(parts[1])
                
                # 规则：只归档“过去月份”的文件夹
                if item_year < today.year or (item_year == today.year and item_month < today.month):
                    month_str = f"{item_year}-{item_month:02d}"
                    month_path = source_path / month_str
                    month_path.mkdir(exist_ok=True)
                    
                    shutil.move(str(item), str(month_path / item.name))
                    logger.info(f"[月封存] {item.name} -> {month_str}")
            except Exception as e:
                logger.info(f"月封存跳过 {item.name}: {e}")

def main():
    source_path = Path(SOURCE_DIR)
    if not source_path.exists():
        logger.error(f"路径不存在: {SOURCE_DIR}")
        return

    today = datetime.now().date()
    logger.info(f"=== 启动归档程序 (目标: {SOURCE_DIR}) ===")

    # 逻辑递进处理
    organize_files_to_day(source_path, today)
    organize_days_to_week(source_path, today)
    organize_weeks_to_month(source_path, today)

    logger.info("=== 归档任务执行完毕 ===")

if __name__ == "__main__":
    main()
