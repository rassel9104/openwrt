include $(TOPDIR)/rules.mk

PKG_LICENSE:=MIT
PKG_VERSION:=1.3.0
PKG_RELEASE:=2

LUCI_TITLE:=Monitor ligero de red para NanoStation M5
LUCI_DESCRIPTION:=Pruebas HTTP públicas, cuota diaria WAN y reparto prioritario para NanoStation M5
LUCI_DEPENDS:=+luci-base +libcurl +ca-bundle +tc-tiny
LUCI_MAINTAINER:=RaykTo <raktodev@gmail.com>, RaykTo <raykto@aol.com>
LUCI_URL:=mailto:raktodev@gmail.com

define Package/luci-app-nano-monitor/conffiles
/etc/config/nano-monitor
/etc/config/bwlimit
endef

include $(TOPDIR)/feeds/luci/luci.mk

# call BuildPackage - OpenWrt buildroot signature
