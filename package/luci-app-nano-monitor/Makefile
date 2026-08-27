include $(TOPDIR)/rules.mk

PKG_LICENSE:=MIT
PKG_VERSION:=1.4.0
PKG_RELEASE:=23

LUCI_TITLE:=Monitor ligero de red para NanoStation M5
LUCI_DESCRIPTION:=Pruebas HTTP públicas, cuotas WAN y límites individuales sólo para Otros en NanoStation M5
LUCI_DEPENDS:=+luci-base +libcurl +ca-bundle +tc-tiny +busybox
LUCI_MAINTAINER:=RaykTo <raktodev@gmail.com>, RaykTo <raykto@aol.com>
LUCI_URL:=mailto:raktodev@gmail.com

define Package/luci-app-nano-monitor/conffiles
/etc/config/nano-monitor
/etc/config/bwlimit
endef

include $(TOPDIR)/feeds/luci/luci.mk

# call BuildPackage - OpenWrt buildroot signature
