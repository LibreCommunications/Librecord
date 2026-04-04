# Installing Librecord Desktop

Download the latest release from the [GitHub Releases page](https://github.com/LibreCommunications/Librecord/releases/latest).

| Platform | File |
|----------|------|
| Linux | `Librecord-x.x.x.AppImage` |
| Windows | `Librecord.Setup.x.x.x.exe` |
| macOS | `Librecord-x.x.x-arm64.dmg` |

---

## Linux

Librecord ships as an [AppImage](https://appimage.org). AppImages are portable executables that work on most distributions without installation, but they require FUSE 2 and benefit from AppImageLauncher for desktop integration.

### 1. Install FUSE 2

AppImages need `libfuse2` to run. Most distributions ship FUSE 3 by default, so you may need to install the compatibility package.

**Arch Linux:**

```bash
sudo pacman -S fuse2
```

**Ubuntu / Debian:**

```bash
sudo apt install libfuse2
```

**Fedora:**

```bash
sudo dnf install fuse-libs
```

### 2. Install AppImageLauncher

[AppImageLauncher](https://github.com/TheAssassin/AppImageLauncher) integrates AppImages into your desktop environment. It adds them to your application menu, handles updates, and manages their location.

**Arch Linux:**

```bash
# From the AUR (using yay or paru)
yay -S appimagelauncher
```

**Ubuntu / Debian:**

Download the `.deb` package from the [AppImageLauncher releases page](https://github.com/TheAssassin/AppImageLauncher/releases) and install it:

```bash
sudo dpkg -i appimagelauncher_*.deb
sudo apt install -f   # install any missing dependencies
```

**Fedora:**

Download the `.rpm` package from the [AppImageLauncher releases page](https://github.com/TheAssassin/AppImageLauncher/releases) and install it:

```bash
sudo dnf install appimagelauncher_*.rpm
```

### 3. Run Librecord

1. Download `Librecord-x.x.x.AppImage` from the [releases page](https://github.com/LibreCommunications/Librecord/releases/latest).
2. Double-click the AppImage. AppImageLauncher will prompt you to **integrate** it.
3. Click **Integrate and run**. This moves the AppImage to `~/Applications/`, adds Librecord to your application menu, and launches it.

After integration, Librecord appears in your app launcher like any other installed application.

> **Without AppImageLauncher:** You can also run the AppImage directly from a terminal:
> ```bash
> chmod +x Librecord-*.AppImage
> ./Librecord-*.AppImage
> ```

---

## Windows

1. Download `Librecord.Setup.x.x.x.exe` from the [releases page](https://github.com/LibreCommunications/Librecord/releases/latest).
2. Run the installer. You can choose the installation directory during setup.
3. Librecord will launch after installation and can be found in the Start menu.

Auto-updates are built in -- the app will download new versions in the background and install them on restart.

---

## macOS

1. Download `Librecord-x.x.x-arm64.dmg` from the [releases page](https://github.com/LibreCommunications/Librecord/releases/latest).
2. Open the `.dmg` and drag **Librecord** into your **Applications** folder.
3. On first launch, macOS may block the app because it is not signed with an Apple Developer certificate. To open it:
   - Go to **System Settings > Privacy & Security**.
   - Scroll down and click **Open Anyway** next to the Librecord message.

Auto-updates work the same as on Windows.
