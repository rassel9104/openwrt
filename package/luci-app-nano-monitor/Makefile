include $(TOPDIR)/rules.mk

PKG_LICENSE:=MIT
PKG_VERSION:=1.0.0
PKG_RELEASE:=1

LUCI_TITLE:=Monitor ligero de red para NanoStation M5
LUCI_DESCRIPTION:=Pruebas iperf3 contra un VPS y consumo por equipo sin librerías gráficas pesadas
LUCI_DEPENDS:=+luci-base +iperf3 +nlbwmon
LUCI_PKGARCH:=all
LUCI_MAINTAINER:=RaykTo <raktodev@gmail.com>, RaykTo <raykto@aol.com>
LUCI_URL:=mailto:raktodev@gmail.com

define Package/luci-app-nano-monitor/conffiles
/etc/config/nano-monitor
/etc/config/bwlimit
/etc/init.d/bwlimit
endef

include $(TOPDIR)/feeds/luci/luci.mk

# call BuildPackage - OpenWrt buildroot signature
