# sglbl-logo-animation Plymouth Theme

This is a Plymouth theme with a logo animation.

## Creating an example text logo

Open the odp file in LibreOffice Impress and export it as images using [this extension](https://extensions.libreoffice.org/en/extensions/show/export-as-images)

Rename the files (from `animation - 01.png` to `animation-01.png` ...):

```bash
i=0; for f in animation*.png; do   printf -v n "%02d" "$i"; sudo  mv "$f" "animation-$n.png";   ((i++)); done
```

## Installation

1.  Install the theme:

    ```bash
    sudo update-alternatives --install /usr/share/plymouth/themes/default.plymouth default.plymouth /usr/share/plymouth/themes/sglbl-logo-animation/sglbl-logo-animation.plymouth 100
    ```

2.  Select the theme:

    ```bash
    sudo update-alternatives --config default.plymouth
    ```

3.  Update the initramfs:

    ```bash
    sudo update-initramfs -u
    ```

