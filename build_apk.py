import os
import shutil
import subprocess

def sync_assets():
    project_root = os.path.dirname(os.path.abspath(__file__))
    frontend_dir = os.path.join(project_root, 'frontend')
    assets_dir = os.path.join(project_root, 'android', 'app', 'src', 'main', 'assets', 'www')

    print("==================================================")
    print("🚀 1. 正在实时同步前端 Web 静态资源到安卓工程...")
    if os.path.exists(assets_dir):
        shutil.rmtree(assets_dir)
    
    os.makedirs(assets_dir, exist_ok=True)
    
    for item in os.listdir(frontend_dir):
        s = os.path.join(frontend_dir, item)
        d = os.path.join(assets_dir, item)
        if os.path.isdir(s):
            shutil.copytree(s, d)
        else:
            shutil.copy2(s, d)
            
    print(f"✅ 前端资源同步成功！目标路径:\n   {assets_dir}")
    print("==================================================")

def attempt_build():
    print("\n📦 2. 尝试调用 Gradle 进行本地 APK 编译打包...")
    project_root = os.path.dirname(os.path.abspath(__file__))
    android_dir = os.path.join(project_root, 'android')
    gradlew_bat = os.path.join(android_dir, 'gradlew.bat')

    # 检查是否安装 Java
    try:
        res = subprocess.run(["java", "-version"], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        has_java = (res.returncode == 0)
    except Exception:
        has_java = False

    if not has_java:
        print("\n⚠️ 【系统未安装/配置 Java (JDK) 开发环境】")
        print("--------------------------------------------------")
        print("因为安卓应用（APK）在底层必须通过 Java/Gradle 编译器进行编译，")
        print("在纯终端下直接生成 .apk 文件需要系统安装有 JDK (Java Development Kit)。")
        print("\n💡 建议完成方式（二选一）：")
        print("1. 官方推荐：下载并安装 Android Studio (内置 JDK 与 SDK 编译器)，打开 'android' 目录一键导出 APK。")
        print("2. 终端打包：在电脑上安装 JDK (Java 11 或 17)，然后重新双击 build_apk.bat 即可自动生成 APK！")
        print("--------------------------------------------------")
        return

    print("⚡ 检测到 Java 环境，正在调用 gradlew assembleDebug 执行打包编译，请稍候...")
    try:
        build_res = subprocess.run([gradlew_bat, "assembleDebug"], cwd=android_dir)
        if build_res.returncode == 0:
            print("\n🎉🎉🎉 恭喜！APK 编译成功！")
            print(f"安装包路径: {os.path.join(android_dir, 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk')}")
        else:
            print("\n❌ 编译过程返回错误，请检查 Android SDK 配置。")
    except Exception as e:
        print(f"\n❌ 执行编译失败: {e}")

if __name__ == '__main__':
    sync_assets()
    attempt_build()
